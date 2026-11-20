import type { ArchitectureProject, EntityId } from '@domain/types';

export interface StoredProjectRecord {
  readonly id: EntityId;
  readonly schemaVersion: 1;
  readonly persistedRevision: number;
  readonly savedAt: string;
  readonly project: ArchitectureProject;
}

export interface ProjectSummary {
  readonly id: EntityId;
  readonly name: string;
  readonly updatedAt: string;
  readonly persistedRevision: number;
}

export class RevisionConflictError extends Error {
  readonly expectedRevision: number | null;
  readonly actualRevision: number | null;

  constructor(expectedRevision: number | null, actualRevision: number | null, message?: string) {
    super(
      message ??
        `Conflito de revisão ao salvar projeto (esperada: ${String(expectedRevision)}, atual: ${String(actualRevision)}).`,
    );
    this.name = 'RevisionConflictError';
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class StorageQuotaError extends Error {
  constructor(message = 'Espaço de armazenamento local (IndexedDB) excedido.') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export class StorageTransactionError extends Error {
  constructor(message = 'Falha transacional ao acessar o armazenamento local (IndexedDB).') {
    super(message);
    this.name = 'StorageTransactionError';
  }
}

export interface ProjectRepository {
  listSummaries(): Promise<readonly ProjectSummary[]>;
  load(projectId: EntityId): Promise<StoredProjectRecord | null>;
  save(project: ArchitectureProject, expectedRevision: number | null): Promise<number>;
  delete(projectId: EntityId): Promise<void>;
  close(): void;
}
