import type { EntityId, Point2D } from '@domain/types';

export interface LayoutGraphNodeInput {
  readonly id: EntityId;
  readonly width: number;
  readonly height: number;
}

export interface LayoutGraphEdgeInput {
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
}

export interface LayoutGraphInput {
  readonly nodes: readonly LayoutGraphNodeInput[];
  readonly edges: readonly LayoutGraphEdgeInput[];
}

export interface LayoutGraphOutput {
  readonly positions: Readonly<Record<EntityId, Point2D>>;
}

export interface LayoutPort {
  computeLayout(input: LayoutGraphInput, signal?: AbortSignal): Promise<LayoutGraphOutput>;
}
