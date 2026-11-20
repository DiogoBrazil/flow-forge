import {
  RevisionConflictError,
  StorageQuotaError,
} from '@application/ports/ProjectRepository';
import type {
  ProjectRepository,
  ProjectSummary,
  StoredProjectRecord,
} from '@application/ports/ProjectRepository';
import type { ArchitectureProject, EntityId } from '@domain/types';

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly store = new Map<EntityId, StoredProjectRecord>();
  private readonly clock: () => string;
  public failNextSaveWithQuota = false;

  constructor(clock: () => string = () => '2026-11-20T12:00:00.000Z') {
    this.clock = clock;
  }

  async listSummaries(): Promise<readonly ProjectSummary[]> {
    return [...this.store.values()]
      .map((rec) => ({
        id: rec.id,
        name: rec.project.name,
        updatedAt: rec.project.updatedAt,
        persistedRevision: rec.persistedRevision,
      }))
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0));
  }

  async load(projectId: EntityId): Promise<StoredProjectRecord | null> {
    const rec = this.store.get(projectId);
    return rec ? structuredClone(rec) : null;
  }

  async save(project: ArchitectureProject, expectedRevision: number | null): Promise<number> {
    if (this.failNextSaveWithQuota) {
      this.failNextSaveWithQuota = false;
      throw new StorageQuotaError();
    }

    const stored = this.store.get(project.id);
    if (expectedRevision === null) {
      if (stored) {
        throw new RevisionConflictError(null, stored.persistedRevision);
      }
    } else {
      if (!stored) {
        throw new RevisionConflictError(expectedRevision, null);
      }
      if (stored.persistedRevision !== expectedRevision) {
        throw new RevisionConflictError(expectedRevision, stored.persistedRevision);
      }
    }

    const nextRevision = expectedRevision === null ? 1 : expectedRevision + 1;
    this.store.set(project.id, {
      id: project.id,
      schemaVersion: 1,
      persistedRevision: nextRevision,
      savedAt: this.clock(),
      project: structuredClone(project),
    });
    return nextRevision;
  }

  async delete(projectId: EntityId): Promise<void> {
    this.store.delete(projectId);
  }

  close(): void {
    // No-op for in-memory repository
  }

  /** Helper for tests simulating external modification in another tab */
  setRawRecord(record: StoredProjectRecord): void {
    this.store.set(record.id, structuredClone(record));
  }
}
