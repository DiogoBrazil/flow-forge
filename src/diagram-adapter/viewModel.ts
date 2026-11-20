import type { EntityId, Point2D } from '@domain/types';
import type { DiagnosticSeverity } from '@rules/types';

export interface NodeBadgeViewModel {
  readonly text: string;
  readonly variant: 'bound' | 'warning';
}

export interface DiagramNodeViewModel extends Record<string, unknown> {
  readonly id: EntityId;
  readonly label: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly layer?: string;
  readonly technology?: string;
  readonly position: Point2D;
  readonly drillable: boolean;
  readonly badges: readonly NodeBadgeViewModel[];
  readonly diagnosticSeverity: DiagnosticSeverity | null;
  readonly highlighted: boolean;
}

export type DiagramEdgeStyleKind =
  | 'sync-call'
  | 'data-access'
  | 'cache-access'
  | 'async-publish'
  | 'async-consume'
  | 'depends-on'
  | 'implements';

export interface DiagramEdgeViewModel {
  readonly id: EntityId;
  readonly source: EntityId;
  readonly target: EntityId;
  readonly label: string;
  readonly styleKind: DiagramEdgeStyleKind;
  readonly diagnosticSeverity: DiagnosticSeverity | null;
  readonly highlighted: boolean;
}

export interface DiagramViewModel {
  readonly nodes: readonly DiagramNodeViewModel[];
  readonly edges: readonly DiagramEdgeViewModel[];
}
