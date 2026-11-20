import type { ArchitectureProject, EntityId, ViewScope } from '@domain/types';

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticTargetKind =
  | 'system-node'
  | 'runtime-connection'
  | 'code-unit'
  | 'static-dependency'
  | 'boundary-binding';

export interface DiagnosticTarget {
  readonly kind: DiagnosticTargetKind;
  readonly id: EntityId;
}

export interface Diagnostic {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: DiagnosticSeverity;
  readonly scope: ViewScope;
  readonly title: string;
  readonly message: string;
  readonly suggestion: string;
  readonly targets: readonly DiagnosticTarget[];
  readonly evidence: Readonly<Record<string, unknown>>;
}

export type ArchitectureRule = (project: ArchitectureProject) => readonly Diagnostic[];

export function formatScopeKey(scope: ViewScope): string {
  return scope.level === 'system' ? 'system' : `internal:${scope.serviceId}`;
}

export function buildDiagnosticId(
  ruleId: string,
  scope: ViewScope,
  targets: readonly DiagnosticTarget[],
): string {
  const scopeKey = formatScopeKey(scope);
  const sortedTargets = targets
    .map((t) => `${t.kind}:${t.id}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `${ruleId}:${scopeKey}:${sortedTargets.join(',')}`;
}
