import type { ArchitectureProject } from '@domain/types';
import { SnapshotHistory } from '../history/SnapshotHistory';

export interface WorkspaceSession {
  currentProject: ArchitectureProject | null;
  lastPersistedRevision: number | null;
  mutationSeq: number;
  readonly history: SnapshotHistory;
}

export function createWorkspaceSession(maxHistorySize?: number): WorkspaceSession {
  return {
    currentProject: null,
    lastPersistedRevision: null,
    mutationSeq: 0,
    history: new SnapshotHistory(maxHistorySize),
  };
}

export interface HistoryStateSnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly pastCount: number;
  readonly futureCount: number;
  readonly mutationSeq: number;
  readonly lastPersistedRevision: number | null;
}

export function readHistoryState(session: WorkspaceSession): HistoryStateSnapshot {
  return {
    canUndo: session.history.canUndo(),
    canRedo: session.history.canRedo(),
    pastCount: session.history.getPastCount(),
    futureCount: session.history.getFutureCount(),
    mutationSeq: session.mutationSeq,
    lastPersistedRevision: session.lastPersistedRevision,
  };
}
