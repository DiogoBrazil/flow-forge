import { describe, expect, it } from 'vitest';
import { MAX_SNAPSHOT_HISTORY } from '@application/history/SnapshotHistory';
import { RevisionConflictError, StorageQuotaError } from '@application/ports/ProjectRepository';
import { applyViewLayout } from '@application/use-cases/applyViewLayout';
import {
  editProject,
  getHistoryState,
  redoProjectEdit,
  undoProjectEdit,
} from '@application/use-cases/editArchitecture';
import {
  exportEmergencyJson,
  exportProject,
  importProject,
} from '@application/use-cases/importExportProject';
import type { ImportFileSource } from '@application/use-cases/importExportProject';
import {
  createProject,
  createProjectFromExample,
  deleteProject,
  listProjects,
  openProject,
  saveProject,
} from '@application/use-cases/projectLifecycle';
import { createWorkspaceSession } from '@application/use-cases/sessionState';
import type { ViewScope } from '@domain/types';
import { MAX_IMPORT_FILE_BYTES } from '@schemas/projectFileV1';
import { InMemoryProjectRepository } from '../../fakes/InMemoryProjectRepository';
import { StubLayoutAdapter } from '../../fakes/StubLayoutAdapter';

const CLOCK = () => '2026-11-20T12:00:00.000Z';

function makeFileSource(fileName: string, content: string, byteLength?: number): ImportFileSource {
  return {
    fileName,
    byteLength: byteLength ?? Buffer.byteLength(content, 'utf8'),
    readText: async () => content,
  };
}

describe('Application use cases: lifecycle, editing, SnapshotHistory, layout & import/export', () => {
  it('enforces exact 50-snapshot limit in SnapshotHistory and restores atomic cascades without regressing lastPersistedRevision', async () => {
    const repo = new InMemoryProjectRepository(CLOCK);
    const session = createWorkspaceSession();
    let idSeq = 1;
    const idGenerator = () => `id-${idSeq++}`;

    await createProject({ projectRepo: repo, session, clock: CLOCK, idGenerator }, { name: 'Orders' });
    expect(session.lastPersistedRevision).toBe(1);

    // Add 2 nodes + 1 connection + internal arch + adapter + binding
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        { type: 'addSystemNode', payload: { id: 'gw', name: 'GW', kind: 'gateway', position: { x: 0, y: 0 } } },
      ).ok,
    ).toBe(true);
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        { type: 'addSystemNode', payload: { id: 'svc', name: 'Svc', kind: 'service', position: { x: 200, y: 0 } } },
      ).ok,
    ).toBe(true);
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        {
          type: 'addRuntimeConnection',
          payload: { id: 'c1', sourceId: 'gw', targetId: 'svc', kind: 'sync-call', protocol: 'http' },
        },
      ).ok,
    ).toBe(true);
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        { type: 'ensureInternalArchitecture', payload: { serviceId: 'svc', viewId: 'v-svc' } },
      ).ok,
    ).toBe(true);
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        {
          type: 'addCodeUnit',
          payload: { serviceId: 'svc', id: 'u-in', name: 'Http', kind: 'inbound-adapter', position: { x: 0, y: 0 } },
        },
      ).ok,
    ).toBe(true);
    expect(
      editProject(
        { session, clock: CLOCK, idGenerator },
        {
          type: 'addBoundaryBinding',
          payload: { id: 'b1', serviceId: 'svc', runtimeConnectionId: 'c1', adapterUnitId: 'u-in' },
        },
      ).ok,
    ).toBe(true);

    // Save -> persistedRevision advances to 2
    const saved = await saveProject({ projectRepo: repo, session, clock: CLOCK });
    expect(saved.persistedRevision).toBe(2);

    // Cascade delete connection -> removes binding too
    const delRes = editProject(
      { session, clock: CLOCK, idGenerator },
      { type: 'deleteRuntimeConnection', payload: { id: 'c1' } },
    );
    expect(delRes.ok).toBe(true);
    expect(session.currentProject?.bindings).toHaveLength(0);

    // Undo restores connection + binding atomically AND keeps lastPersistedRevision === 2
    const undone = undoProjectEdit({ session });
    expect(undone.ok).toBe(true);
    expect(session.currentProject?.topology.connections).toHaveLength(1);
    expect(session.currentProject?.bindings).toHaveLength(1);
    expect(session.lastPersistedRevision).toBe(2);

    // Saving after Undo succeeds cleanly without RevisionConflictError (advances to 3)
    const savedAfterUndo = await saveProject({ projectRepo: repo, session, clock: CLOCK });
    expect(savedAfterUndo.persistedRevision).toBe(3);

    // Redo restores deletion
    const redone = redoProjectEdit({ session });
    expect(redone.ok).toBe(true);
    expect(session.currentProject?.bindings).toHaveLength(0);

    // Push 60 edits -> past stack capped at exactly MAX_SNAPSHOT_HISTORY (50)
    for (let i = 0; i < 60; i++) {
      editProject(
        { session, clock: CLOCK, idGenerator },
        { type: 'updateSystemNode', payload: { id: 'gw', name: `GW-${i}` } },
      );
    }
    const hist = getHistoryState({ session });
    expect(hist.pastCount).toBe(MAX_SNAPSHOT_HISTORY);
    expect(hist.canUndo).toBe(true);
    expect(hist.canRedo).toBe(false);
  });

  it('reverts applyViewLayout in 1 Undo and discards stale layout after edit -> layout -> Undo -> Redo or scope switch', async () => {
    const repo = new InMemoryProjectRepository(CLOCK);
    const layoutPort = new StubLayoutAdapter();
    const session = createWorkspaceSession();
    let activeScope: ViewScope = { level: 'system' };

    await createProject({ projectRepo: repo, session, clock: CLOCK }, { id: 'p-lay', name: 'Layout Test' });
    editProject(
      { session, clock: CLOCK },
      { type: 'addSystemNode', payload: { id: 'n1', name: 'N1', kind: 'service', position: { x: 10, y: 20 } } },
    );
    editProject(
      { session, clock: CLOCK },
      { type: 'addSystemNode', payload: { id: 'n2', name: 'N2', kind: 'database', position: { x: 30, y: 40 } } },
    );

    // Normal layout applies in 1 commit with changedSemantically: false
    const applied = await applyViewLayout(
      { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
      { scope: { level: 'system' } },
    );
    expect(applied.status).toBe('applied');
    if (applied.status === 'applied') {
      expect(applied.changedSemantically).toBe(false);
      const sysView = applied.project.views.find((v) => v.scope.level === 'system');
      expect(sysView?.nodePositions['n1']).toEqual({ x: 100, y: 120 });
      expect(sysView?.nodePositions['n2']).toEqual({ x: 400, y: 120 });
    }

    // 1 Undo restores exact previous coordinates
    const undone = undoProjectEdit({ session });
    expect(undone.ok).toBe(true);
    const restoredView = session.currentProject?.views.find((v) => v.scope.level === 'system');
    expect(restoredView?.nodePositions['n1']).toEqual({ x: 10, y: 20 });
    expect(restoredView?.nodePositions['n2']).toEqual({ x: 30, y: 40 });

    // Stale layout test: start layout -> Undo -> Redo -> release layout => MUST be discarded because mutationSeq advanced
    layoutPort.manualGate = true;
    const pendingLayout = applyViewLayout(
      { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
      { scope: { level: 'system' } },
    );
    undoProjectEdit({ session });
    redoProjectEdit({ session });
    layoutPort.releasePending();

    const staleRes = await pendingLayout;
    expect(staleRes).toEqual({ status: 'discarded', reason: 'STALE_MUTATION_OR_SCOPE' });

    // Stale layout due to scope switch
    const pendingScopeLayout = applyViewLayout(
      { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
      { scope: { level: 'system' } },
    );
    activeScope = { level: 'internal', serviceId: 'n1' };
    layoutPort.releasePending();
    expect(await pendingScopeLayout).toEqual({ status: 'discarded', reason: 'STALE_MUTATION_OR_SCOPE' });
  });

  it('enforces 4-stage safe import pipeline, ID conflict (copy vs replace monotonic revision), export & quota errors', async () => {
    const repo = new InMemoryProjectRepository(CLOCK);
    const session = createWorkspaceSession();
    let idSeq = 100;
    const idGenerator = () => `copy-${idSeq++}`;

    // Stage 1: invalid extension & > 5MB rejected BEFORE readText
    let readCalled = false;
    const badExt = await importProject(
      { projectRepo: repo, session, clock: CLOCK },
      {
        fileName: 'model.txt',
        byteLength: 10,
        readText: async () => {
          readCalled = true;
          return '{}';
        },
      },
    );
    expect(badExt.ok).toBe(false);
    if (!badExt.ok) expect(badExt.code).toBe('INVALID_FILE_EXTENSION');
    expect(readCalled).toBe(false);

    const tooBig = await importProject(
      { projectRepo: repo, session, clock: CLOCK },
      {
        fileName: 'huge.json',
        byteLength: MAX_IMPORT_FILE_BYTES + 1,
        readText: async () => {
          readCalled = true;
          return '{}';
        },
      },
    );
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.code).toBe('FILE_TOO_LARGE');
    expect(readCalled).toBe(false);

    // Stage 2: invalid JSON & future schemaVersion
    const badJson = await importProject(
      { projectRepo: repo, session, clock: CLOCK },
      makeFileSource('broken.json', '{not-json'),
    );
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.code).toBe('INVALID_JSON');

    const futureVer = await importProject(
      { projectRepo: repo, session, clock: CLOCK },
      makeFileSource('v99.json', JSON.stringify({ schemaVersion: 99, project: {} })),
    );
    expect(futureVer.ok).toBe(false);
    if (!futureVer.ok) expect(futureVer.code).toBe('UNSUPPORTED_FUTURE_VERSION');

    // Load valid example via createProjectFromExample -> export -> re-import conflict -> copy & replace
    const fromEx = await createProjectFromExample(
      { projectRepo: repo, session, clock: CLOCK, idGenerator },
      'hexagonal-orders-valid',
    );
    expect(fromEx.ok).toBe(true);
    if (!fromEx.ok) return;

    const exportedJson = exportProject(fromEx.project, CLOCK);
    expect(exportEmergencyJson(fromEx.project, CLOCK)).toBe(exportedJson);

    // Re-importing same ID without strategy yields ID_CONFLICT
    const conflict = await importProject(
      { projectRepo: repo, session, clock: CLOCK, idGenerator },
      makeFileSource('orders.json', exportedJson),
    );
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe('ID_CONFLICT');

    // Copy strategy creates new project with persistedRevision = 1
    const copied = await importProject(
      { projectRepo: repo, session, clock: CLOCK, idGenerator },
      makeFileSource('orders.json', exportedJson),
      { conflictStrategy: 'copy' },
    );
    expect(copied.ok).toBe(true);
    if (copied.ok) {
      expect(copied.resolution).toBe('copied');
      expect(copied.persistedRevision).toBe(1);
      expect(copied.project.id).not.toBe(fromEx.project.id);
      expect(copied.project.name).toContain('(Cópia)');
    }

    // Replace strategy advances persistedRevision monotonically (1 -> 2)
    const replaced = await importProject(
      { projectRepo: repo, session, clock: CLOCK, idGenerator },
      makeFileSource('orders.json', exportedJson),
      { conflictStrategy: 'replace' },
    );
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.resolution).toBe('replaced');
      expect(replaced.persistedRevision).toBe(2);
    }

    // Open, list, delete & QuotaExceededError propagation
    const summaries = await listProjects({ projectRepo: repo });
    expect(summaries).toHaveLength(2);

    const opened = await openProject({ projectRepo: repo, session, clock: CLOCK }, fromEx.project.id);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.persistedRevision).toBe(2);

    repo.failNextSaveWithQuota = true;
    await expect(saveProject({ projectRepo: repo, session, clock: CLOCK })).rejects.toBeInstanceOf(
      StorageQuotaError,
    );

    // Simulate external revision bump -> RevisionConflictError
    const rec = await repo.load(fromEx.project.id);
    repo.setRawRecord({ ...rec!, persistedRevision: 9 });
    await expect(saveProject({ projectRepo: repo, session, clock: CLOCK })).rejects.toBeInstanceOf(
      RevisionConflictError,
    );

    await deleteProject({ projectRepo: repo, session, clock: CLOCK }, fromEx.project.id);
    expect(session.currentProject).toBeNull();
    const notFound = await openProject({ projectRepo: repo, session, clock: CLOCK }, fromEx.project.id);
    expect(notFound.ok).toBe(false);
  });

  it('covers internal layout, empty/no-project guards, corrupted openProject, unknown example and all edit commands', async () => {
    const repo = new InMemoryProjectRepository(CLOCK);
    const layoutPort = new StubLayoutAdapter();
    const session = createWorkspaceSession();
    let activeScope: ViewScope = { level: 'system' };

    // Guards with no active project
    expect(editProject({ session, clock: CLOCK }, { type: 'setRuleProfile', payload: { ruleProfile: 'layered' } }).ok).toBe(false);
    expect(undoProjectEdit({ session }).ok).toBe(false);
    expect(redoProjectEdit({ session }).ok).toBe(false);
    await expect(saveProject({ projectRepo: repo, session, clock: CLOCK })).rejects.toThrow();
    expect(
      await applyViewLayout(
        { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
        { scope: { level: 'system' } },
      ),
    ).toEqual({ status: 'discarded', reason: 'NO_ACTIVE_PROJECT' });

    // Unknown example
    const badEx = await createProjectFromExample({ projectRepo: repo, session, clock: CLOCK }, 'nonexistent');
    expect(badEx.ok).toBe(false);

    // Corrupted stored project & invalid invariants on import
    await createProject({ projectRepo: repo, session, clock: CLOCK }, { id: 'p-cov', name: 'Cov' });
    expect(undoProjectEdit({ session }).ok).toBe(false);
    expect(redoProjectEdit({ session }).ok).toBe(false);

    // Empty system scope layout discarded
    expect(
      await applyViewLayout(
        { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
        { scope: { level: 'system' } },
      ),
    ).toEqual({ status: 'discarded', reason: 'EMPTY_SCOPE' });

    // Exercise remaining editProject dispatch commands + internal scope layout
    editProject({ session, clock: CLOCK }, { type: 'addSystemNode', payload: { id: 's1', name: 'S1', kind: 'service', position: { x: 0, y: 0 } } });
    editProject({ session, clock: CLOCK }, { type: 'addSystemNode', payload: { id: 's2', name: 'S2', kind: 'service', position: { x: 100, y: 0 } } });
    editProject({ session, clock: CLOCK }, { type: 'changeSystemNodeKind', payload: { id: 's2', kind: 'database' } });
    editProject({ session, clock: CLOCK }, { type: 'addRuntimeConnection', payload: { id: 'c1', sourceId: 's1', targetId: 's2', kind: 'data-access', protocol: 'sql' } });
    editProject({ session, clock: CLOCK }, { type: 'updateRuntimeConnection', payload: { id: 'c1', label: 'db' } });
    editProject({ session, clock: CLOCK }, { type: 'reconnectRuntimeConnection', payload: { id: 'c1', targetId: 's2' } });
    editProject({ session, clock: CLOCK }, { type: 'ensureInternalArchitecture', payload: { serviceId: 's1', viewId: 'v-s1' } });
    editProject({ session, clock: CLOCK }, { type: 'addCodeUnit', payload: { serviceId: 's1', id: 'u1', name: 'U1', kind: 'outbound-adapter', position: { x: 0, y: 0 } } });
    editProject({ session, clock: CLOCK }, { type: 'addCodeUnit', payload: { serviceId: 's1', id: 'u2', name: 'U2', kind: 'interface', position: { x: 100, y: 0 } } });
    editProject({ session, clock: CLOCK }, { type: 'updateCodeUnit', payload: { serviceId: 's1', id: 'u1', name: 'U1b' } });
    editProject({ session, clock: CLOCK }, { type: 'addStaticDependency', payload: { serviceId: 's1', id: 'd1', sourceId: 'u1', targetId: 'u2', kind: 'implements' } });
    editProject({ session, clock: CLOCK }, { type: 'updateStaticDependency', payload: { serviceId: 's1', id: 'd1', label: 'impl' } });
    editProject({ session, clock: CLOCK }, { type: 'addBoundaryBinding', payload: { id: 'b1', serviceId: 's1', runtimeConnectionId: 'c1', adapterUnitId: 'u1' } });
    editProject({ session, clock: CLOCK }, { type: 'setRuleProfile', payload: { ruleProfile: 'layered' } });
    editProject({ session, clock: CLOCK }, { type: 'updateViewNodePositions', payload: { scope: { level: 'system' }, positions: { s1: { x: 5, y: 5 } } } });

    // Apply layout on internal scope
    activeScope = { level: 'internal', serviceId: 's1' };
    const intLayout = await applyViewLayout(
      { layoutPort, session, getActiveScope: () => activeScope, clock: CLOCK },
      { scope: activeScope, measuredDimensions: { u1: { width: 240, height: 90 } } },
    );
    expect(intLayout.status).toBe('applied');

    editProject({ session, clock: CLOCK }, { type: 'deleteBoundaryBinding', payload: { id: 'b1' } });
    editProject({ session, clock: CLOCK }, { type: 'deleteStaticDependency', payload: { serviceId: 's1', id: 'd1' } });
    editProject({ session, clock: CLOCK }, { type: 'deleteCodeUnit', payload: { serviceId: 's1', id: 'u2' } });
    editProject({ session, clock: CLOCK }, { type: 'clearInternalArchitectureAndChangeKind', payload: { id: 's1', kind: 'gateway' } });
    editProject({ session, clock: CLOCK }, { type: 'deleteSystemNode', payload: { id: 's1' } });

    // Structural invariant failure on import
    const badInvariantJson = JSON.stringify({
      schemaVersion: 1,
      project: {
        id: 'bad-inv',
        name: 'Bad',
        description: '',
        ruleProfile: 'hexagonal',
        createdAt: CLOCK(),
        updatedAt: CLOCK(),
        topology: { nodes: [], connections: [] },
        internals: {},
        bindings: [],
        views: [],
      },
    });
    const invFail = await importProject(
      { projectRepo: repo, session, clock: CLOCK },
      makeFileSource('bad.json', badInvariantJson),
    );
    expect(invFail.ok).toBe(false);
    if (!invFail.ok) expect(invFail.code).toBe('STRUCTURAL_INVARIANT_VIOLATION');

    // Corrupted record in repo fails openProject cleanly
    repo.setRawRecord({
      id: 'corrupt-1',
      schemaVersion: 1,
      persistedRevision: 1,
      savedAt: CLOCK(),
      project: { ...session.currentProject!, views: [] },
    });
    const corruptOpen = await openProject({ projectRepo: repo, session, clock: CLOCK }, 'corrupt-1');
    expect(corruptOpen.ok).toBe(false);
    if (!corruptOpen.ok) expect(corruptOpen.code).toBe('CORRUPTED_PROJECT');
  });
});
