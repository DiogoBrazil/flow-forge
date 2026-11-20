import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import {
  RevisionConflictError,
  StorageQuotaError,
  StorageTransactionError,
} from '@application/ports/ProjectRepository';
import type {
  ProjectRepository,
  ProjectSummary,
  StoredProjectRecord,
} from '@application/ports/ProjectRepository';
import type { ArchitectureProject, EntityId } from '@domain/types';
import { CURRENT_SCHEMA_VERSION } from '@schemas/projectFileV1';

export const FLOW_FORGE_DB_NAME = 'flow-forge-db';
export const FLOW_FORGE_DB_VERSION = 1;
const PROJECTS_STORE = 'projects';

interface FlowForgeDbSchema extends DBSchema {
  projects: {
    key: EntityId;
    value: StoredProjectRecord;
  };
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: unknown }).name;
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
}

export class IndexedDBProjectRepository implements ProjectRepository {
  private readonly dbName: string;
  private readonly clock: () => string;
  private dbPromise: Promise<IDBPDatabase<FlowForgeDbSchema>> | null = null;
  private persistenceRequested = false;

  constructor(
    dbName: string = FLOW_FORGE_DB_NAME,
    clock: () => string = () => new Date().toISOString(),
  ) {
    this.dbName = dbName;
    this.clock = clock;
  }

  private async getDb(): Promise<IDBPDatabase<FlowForgeDbSchema>> {
    if (!this.persistenceRequested && typeof navigator !== 'undefined') {
      this.persistenceRequested = true;
      try {
        void navigator.storage?.persist?.();
      } catch {
        // Best-effort storage persistence request
      }
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB<FlowForgeDbSchema>(this.dbName, FLOW_FORGE_DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
            database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          }
        },
      });
    }

    return this.dbPromise;
  }

  async listSummaries(): Promise<readonly ProjectSummary[]> {
    try {
      const db = await this.getDb();
      const records = await db.getAll(PROJECTS_STORE);
      return records
        .map((rec) => ({
          id: rec.id,
          name: rec.project.name,
          updatedAt: rec.project.updatedAt,
          persistedRevision: rec.persistedRevision,
        }))
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0));
    } catch (err) {
      throw new StorageTransactionError(
        `Falha ao listar projetos do IndexedDB: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async load(projectId: EntityId): Promise<StoredProjectRecord | null> {
    try {
      const db = await this.getDb();
      const record = await db.get(PROJECTS_STORE, projectId);
      return record ?? null;
    } catch (err) {
      throw new StorageTransactionError(
        `Falha ao carregar projeto "${projectId}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async save(project: ArchitectureProject, expectedRevision: number | null): Promise<number> {
    const db = await this.getDb();
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE);

    try {
      const stored = await store.get(project.id);

      if (expectedRevision === null) {
        if (stored !== undefined) {
          tx.abort();
          throw new RevisionConflictError(
            null,
            stored.persistedRevision,
            `Projeto "${project.id}" já existe na revisão ${stored.persistedRevision}.`,
          );
        }
      } else {
        if (stored === undefined) {
          tx.abort();
          throw new RevisionConflictError(
            expectedRevision,
            null,
            `Projeto "${project.id}" foi excluído externamente antes do salvamento.`,
          );
        }
        if (stored.persistedRevision !== expectedRevision) {
          tx.abort();
          throw new RevisionConflictError(
            expectedRevision,
            stored.persistedRevision,
            `Conflito de revisão em "${project.id}": esperada ${expectedRevision}, persistida ${stored.persistedRevision}.`,
          );
        }
      }

      const nextRevision = expectedRevision === null ? 1 : expectedRevision + 1;
      const record: StoredProjectRecord = {
        id: project.id,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        persistedRevision: nextRevision,
        savedAt: this.clock(),
        project,
      };

      await store.put(record);
      await tx.done;
      return nextRevision;
    } catch (err) {
      if (err instanceof RevisionConflictError) {
        await tx.done.catch(() => undefined);
        throw err;
      }
      if (isQuotaError(err)) {
        await tx.done.catch(() => undefined);
        throw new StorageQuotaError();
      }
      await tx.done.catch(() => undefined);
      throw new StorageTransactionError(
        `Falha ao salvar projeto "${project.id}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(projectId: EntityId): Promise<void> {
    try {
      const db = await this.getDb();
      await db.delete(PROJECTS_STORE, projectId);
    } catch (err) {
      throw new StorageTransactionError(
        `Falha ao excluir projeto "${projectId}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  close(): void {
    if (this.dbPromise) {
      const pending = this.dbPromise;
      this.dbPromise = null;
      void pending.then((db) => db.close()).catch(() => undefined);
    }
  }
}
