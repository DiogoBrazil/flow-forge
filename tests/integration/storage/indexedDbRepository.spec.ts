import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RevisionConflictError,
  StorageQuotaError,
} from '@application/ports/ProjectRepository';
import { createEmptyProject } from '@domain/commands';
import { IndexedDBProjectRepository } from '@storage/IndexedDBProjectRepository';

const NOW = '2026-11-20T12:00:00.000Z';

function makeProject(id: string, name: string) {
  const res = createEmptyProject({ id, name, systemViewId: `v-${id}` }, NOW);
  if (!res.ok) throw new Error('Failed to build test project');
  return res.value;
}

describe('IndexedDBProjectRepository (fake-indexeddb integration)', () => {
  const createdDbs: { repo: IndexedDBProjectRepository; dbName: string }[] = [];

  function createRepo(suffix: string): IndexedDBProjectRepository {
    const dbName = `flow-forge-test-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
    const repo = new IndexedDBProjectRepository(dbName, () => NOW);
    createdDbs.push({ repo, dbName });
    return repo;
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const item of createdDbs.splice(0)) {
      item.repo.close();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(item.dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }
  });

  it('saves atomically, loads full record, lists summaries and increments persistedRevision via CAS', async () => {
    const repo = createRepo('crud');
    const p1 = makeProject('proj-1', 'Orders');

    const rev1 = await repo.save(p1, null);
    expect(rev1).toBe(1);

    const loaded = await repo.load('proj-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.persistedRevision).toBe(1);
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.project.name).toBe('Orders');

    const p1Updated = { ...p1, name: 'Orders v2', updatedAt: '2026-11-20T13:00:00.000Z' };
    const rev2 = await repo.save(p1Updated, 1);
    expect(rev2).toBe(2);

    const summaries = await repo.listSummaries();
    expect(summaries).toEqual([
      {
        id: 'proj-1',
        name: 'Orders v2',
        updatedAt: '2026-11-20T13:00:00.000Z',
        persistedRevision: 2,
      },
    ]);

    await repo.delete('proj-1');
    expect(await repo.load('proj-1')).toBeNull();
  });

  it('detects RevisionConflictError on stale expectedRevision, duplicate creation and external deletion', async () => {
    const repo = createRepo('cas');
    const p = makeProject('proj-cas', 'CAS Test');

    await repo.save(p, null);

    // Duplicate create (expectedRevision === null when record exists)
    await expect(repo.save(p, null)).rejects.toBeInstanceOf(RevisionConflictError);

    // Advance to rev 2
    expect(await repo.save(p, 1)).toBe(2);

    // Stale expectedRevision (1 instead of 2)
    await expect(repo.save(p, 1)).rejects.toBeInstanceOf(RevisionConflictError);

    // External deletion (expectedRevision === 2 when record was deleted)
    await repo.delete('proj-cas');
    await expect(repo.save(p, 2)).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it('maps DOMException QuotaExceededError from IDBObjectStore.prototype.put to StorageQuotaError', async () => {
    const repo = createRepo('quota');
    const p = makeProject('proj-quota', 'Quota Test');

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    await expect(repo.save(p, null)).rejects.toBeInstanceOf(StorageQuotaError);
  });
});
