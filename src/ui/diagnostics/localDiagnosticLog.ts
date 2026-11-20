import { validateStructuralInvariants } from '@domain/invariants';
import type { ArchitectureProject } from '@domain/types';

export interface LocalDiagnosticEvent {
  readonly timestamp: string;
  readonly category: 'lifecycle' | 'edit' | 'validation' | 'storage' | 'layout' | 'import-export';
  readonly code: string;
  readonly durationMs?: number;
  readonly counts?: Readonly<Record<string, number>>;
}

const MAX_EVENTS = 200;

export class LocalDiagnosticLog {
  private readonly events: LocalDiagnosticEvent[] = [];

  record(event: Omit<LocalDiagnosticEvent, 'timestamp'>): void {
    this.events.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }

  getEvents(): readonly LocalDiagnosticEvent[] {
    return [...this.events];
  }

  exportJson(options: { includeProject?: boolean; project?: ArchitectureProject | null } = {}): string {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      eventCount: this.events.length,
      events: this.events,
    };
    if (options.includeProject && options.project) {
      payload['attachedProject'] = options.project;
    }
    return JSON.stringify(payload, null, 2);
  }
}

export function assertDevInvariants(project: ArchitectureProject): void {
  if (!import.meta.env.DEV) return;
  const violations = validateStructuralInvariants(project);
  if (violations.length > 0) {
    throw new Error(
      `[DEV Invariant Guard] Violações estruturais detectadas: ${violations.map((v) => v.code).join(', ')}`,
    );
  }
  // Recursive Proxy check without importing Vue into domain
  structuredClone(project);
}
