import {
  addBoundaryBinding,
  addCodeUnit,
  addRuntimeConnection,
  addStaticDependency,
  addSystemNode,
  changeSystemNodeKind,
  clearInternalArchitectureAndChangeKind,
  deleteBoundaryBinding,
  deleteCodeUnit,
  deleteRuntimeConnection,
  deleteStaticDependency,
  deleteSystemNode,
  ensureInternalArchitecture,
  reconnectRuntimeConnection,
  setRuleProfile,
  updateCodeUnit,
  updateRuntimeConnection,
  updateStaticDependency,
  updateSystemNode,
  updateViewNodePositions,
} from '@domain/commands';
import type {
  AddBoundaryBindingPayload,
  AddCodeUnitPayload,
  AddRuntimeConnectionPayload,
  AddStaticDependencyPayload,
  AddSystemNodePayload,
  ChangeSystemNodeKindPayload,
  DeleteBoundaryBindingPayload,
  DeleteCodeUnitPayload,
  DeleteRuntimeConnectionPayload,
  DeleteStaticDependencyPayload,
  DeleteSystemNodePayload,
  EnsureInternalArchitecturePayload,
  ReconnectRuntimeConnectionPayload,
  SetRuleProfilePayload,
  UpdateCodeUnitPayload,
  UpdateRuntimeConnectionPayload,
  UpdateStaticDependencyPayload,
  UpdateSystemNodePayload,
  UpdateViewNodePositionsPayload,
} from '@domain/commands';
import type { ArchitectureProject, DomainResult, EntityId, StructuralViolation } from '@domain/types';
import { readHistoryState } from './sessionState';
import type { HistoryStateSnapshot, WorkspaceSession } from './sessionState';

export type ArchitectureCommand =
  | { readonly type: 'addSystemNode'; readonly payload: AddSystemNodePayload }
  | { readonly type: 'updateSystemNode'; readonly payload: UpdateSystemNodePayload }
  | { readonly type: 'changeSystemNodeKind'; readonly payload: ChangeSystemNodeKindPayload }
  | {
      readonly type: 'clearInternalArchitectureAndChangeKind';
      readonly payload: ChangeSystemNodeKindPayload;
    }
  | { readonly type: 'deleteSystemNode'; readonly payload: DeleteSystemNodePayload }
  | { readonly type: 'addRuntimeConnection'; readonly payload: AddRuntimeConnectionPayload }
  | { readonly type: 'updateRuntimeConnection'; readonly payload: UpdateRuntimeConnectionPayload }
  | {
      readonly type: 'reconnectRuntimeConnection';
      readonly payload: ReconnectRuntimeConnectionPayload;
    }
  | { readonly type: 'deleteRuntimeConnection'; readonly payload: DeleteRuntimeConnectionPayload }
  | {
      readonly type: 'ensureInternalArchitecture';
      readonly payload: EnsureInternalArchitecturePayload;
    }
  | { readonly type: 'addCodeUnit'; readonly payload: AddCodeUnitPayload }
  | { readonly type: 'updateCodeUnit'; readonly payload: UpdateCodeUnitPayload }
  | { readonly type: 'deleteCodeUnit'; readonly payload: DeleteCodeUnitPayload }
  | { readonly type: 'addStaticDependency'; readonly payload: AddStaticDependencyPayload }
  | { readonly type: 'updateStaticDependency'; readonly payload: UpdateStaticDependencyPayload }
  | { readonly type: 'deleteStaticDependency'; readonly payload: DeleteStaticDependencyPayload }
  | { readonly type: 'addBoundaryBinding'; readonly payload: AddBoundaryBindingPayload }
  | { readonly type: 'deleteBoundaryBinding'; readonly payload: DeleteBoundaryBindingPayload }
  | { readonly type: 'setRuleProfile'; readonly payload: SetRuleProfilePayload }
  | { readonly type: 'updateViewNodePositions'; readonly payload: UpdateViewNodePositionsPayload };

export interface EditArchitectureSuccess {
  readonly ok: true;
  readonly project: ArchitectureProject;
  readonly changedSemantically: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly mutationSeq: number;
}

export interface EditArchitectureFailure {
  readonly ok: false;
  readonly violations: readonly StructuralViolation[];
}

export type EditArchitectureResult = EditArchitectureSuccess | EditArchitectureFailure;

export interface EditArchitectureDeps {
  readonly session: WorkspaceSession;
  readonly clock?: () => string;
  readonly idGenerator?: () => EntityId;
}

function dispatchDomainCommand(
  project: ArchitectureProject,
  command: ArchitectureCommand,
  nowIso: string,
  nextId: () => EntityId,
): DomainResult<ArchitectureProject> {
  switch (command.type) {
    case 'addSystemNode':
      return addSystemNode(project, command.payload, nowIso, nextId);
    case 'updateSystemNode':
      return updateSystemNode(project, command.payload, nowIso);
    case 'changeSystemNodeKind':
      return changeSystemNodeKind(project, command.payload, nowIso);
    case 'clearInternalArchitectureAndChangeKind':
      return clearInternalArchitectureAndChangeKind(project, command.payload, nowIso);
    case 'deleteSystemNode':
      return deleteSystemNode(project, command.payload, nowIso);
    case 'addRuntimeConnection':
      return addRuntimeConnection(project, command.payload, nowIso, nextId);
    case 'updateRuntimeConnection':
      return updateRuntimeConnection(project, command.payload, nowIso);
    case 'reconnectRuntimeConnection':
      return reconnectRuntimeConnection(project, command.payload, nowIso);
    case 'deleteRuntimeConnection':
      return deleteRuntimeConnection(project, command.payload, nowIso);
    case 'ensureInternalArchitecture':
      return ensureInternalArchitecture(project, command.payload, nowIso, nextId);
    case 'addCodeUnit':
      return addCodeUnit(project, command.payload, nowIso, nextId);
    case 'updateCodeUnit':
      return updateCodeUnit(project, command.payload, nowIso);
    case 'deleteCodeUnit':
      return deleteCodeUnit(project, command.payload, nowIso);
    case 'addStaticDependency':
      return addStaticDependency(project, command.payload, nowIso, nextId);
    case 'updateStaticDependency':
      return updateStaticDependency(project, command.payload, nowIso);
    case 'deleteStaticDependency':
      return deleteStaticDependency(project, command.payload, nowIso);
    case 'addBoundaryBinding':
      return addBoundaryBinding(project, command.payload, nowIso, nextId);
    case 'deleteBoundaryBinding':
      return deleteBoundaryBinding(project, command.payload, nowIso);
    case 'setRuleProfile':
      return setRuleProfile(project, command.payload, nowIso);
    case 'updateViewNodePositions':
      return updateViewNodePositions(project, command.payload, nowIso);
  }
}

export function editProject(
  deps: EditArchitectureDeps,
  command: ArchitectureCommand,
): EditArchitectureResult {
  const { session } = deps;
  const current = session.currentProject;
  if (!current) {
    return {
      ok: false,
      violations: [
        {
          code: 'MISSING_REFERENCE',
          message: 'Nenhum projeto ativo na sessão para edição.',
        },
      ],
    };
  }

  const nowIso = (deps.clock ?? (() => new Date().toISOString()))();
  const nextId = deps.idGenerator ?? (() => crypto.randomUUID());

  const result = dispatchDomainCommand(current, command, nowIso, nextId);
  if (!result.ok) {
    return { ok: false, violations: result.violations };
  }

  session.history.push(current);
  session.currentProject = result.value;
  session.mutationSeq += 1;

  const changedSemantically = command.type !== 'updateViewNodePositions';

  return {
    ok: true,
    project: result.value,
    changedSemantically,
    canUndo: session.history.canUndo(),
    canRedo: session.history.canRedo(),
    mutationSeq: session.mutationSeq,
  };
}

export function undoProjectEdit(deps: {
  readonly session: WorkspaceSession;
}): EditArchitectureSuccess | { readonly ok: false } {
  const { session } = deps;
  const current = session.currentProject;
  if (!current) {
    return { ok: false };
  }

  const restored = session.history.undo(current);
  if (!restored) {
    return { ok: false };
  }

  session.currentProject = restored;
  session.mutationSeq += 1;
  // IMPORTANT: lastPersistedRevision is NEVER reverted by undo()

  return {
    ok: true,
    project: restored,
    changedSemantically: true,
    canUndo: session.history.canUndo(),
    canRedo: session.history.canRedo(),
    mutationSeq: session.mutationSeq,
  };
}

export function redoProjectEdit(deps: {
  readonly session: WorkspaceSession;
}): EditArchitectureSuccess | { readonly ok: false } {
  const { session } = deps;
  const current = session.currentProject;
  if (!current) {
    return { ok: false };
  }

  const restored = session.history.redo(current);
  if (!restored) {
    return { ok: false };
  }

  session.currentProject = restored;
  session.mutationSeq += 1;
  // IMPORTANT: lastPersistedRevision is NEVER reverted by redo()

  return {
    ok: true,
    project: restored,
    changedSemantically: true,
    canUndo: session.history.canUndo(),
    canRedo: session.history.canRedo(),
    mutationSeq: session.mutationSeq,
  };
}

export function getHistoryState(deps: {
  readonly session: WorkspaceSession;
}): HistoryStateSnapshot {
  return readHistoryState(deps.session);
}
