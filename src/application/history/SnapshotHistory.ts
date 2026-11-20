import type { ArchitectureProject } from '@domain/types';

export const MAX_SNAPSHOT_HISTORY = 50;

export class SnapshotHistory {
  private readonly maxSize: number;
  private past: ArchitectureProject[] = [];
  private future: ArchitectureProject[] = [];

  constructor(maxSize: number = MAX_SNAPSHOT_HISTORY) {
    this.maxSize = maxSize;
  }

  push(previousSnapshot: ArchitectureProject): void {
    this.past.push(previousSnapshot);
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(currentSnapshot: ArchitectureProject): ArchitectureProject | null {
    const previous = this.past.pop();
    if (!previous) {
      return null;
    }
    this.future.push(currentSnapshot);
    if (this.future.length > this.maxSize) {
      this.future.shift();
    }
    return previous;
  }

  redo(currentSnapshot: ArchitectureProject): ArchitectureProject | null {
    const next = this.future.pop();
    if (!next) {
      return null;
    }
    this.past.push(currentSnapshot);
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  getPastCount(): number {
    return this.past.length;
  }

  getFutureCount(): number {
    return this.future.length;
  }

  reset(): void {
    this.past = [];
    this.future = [];
  }
}
