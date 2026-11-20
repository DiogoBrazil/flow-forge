import { updateViewNodePositions } from '@domain/commands';
import type { ArchitectureProject, EntityId, ViewScope } from '@domain/types';
import type { LayoutGraphEdgeInput, LayoutGraphNodeInput, LayoutPort } from '../ports/LayoutPort';
import type { WorkspaceSession } from './sessionState';

export const DEFAULT_LAYOUT_NODE_WIDTH = 220;
export const DEFAULT_LAYOUT_NODE_HEIGHT = 84;

export interface ApplyViewLayoutDeps {
  readonly layoutPort: LayoutPort;
  readonly session: WorkspaceSession;
  readonly getActiveScope: () => ViewScope;
  readonly clock?: () => string;
}

export interface ApplyViewLayoutInput {
  readonly scope: ViewScope;
  readonly measuredDimensions?: Readonly<Record<EntityId, { readonly width: number; readonly height: number }>>;
  readonly signal?: AbortSignal;
}

export type ApplyViewLayoutResult =
  | {
      readonly status: 'applied';
      readonly project: ArchitectureProject;
      readonly changedSemantically: false;
      readonly canUndo: boolean;
      readonly canRedo: boolean;
      readonly mutationSeq: number;
    }
  | {
      readonly status: 'discarded';
      readonly reason: 'NO_ACTIVE_PROJECT' | 'EMPTY_SCOPE' | 'STALE_MUTATION_OR_SCOPE' | 'INVALID_LAYOUT';
    };

function isSameScope(a: ViewScope, b: ViewScope): boolean {
  if (a.level !== b.level) return false;
  if (a.level === 'system') return true;
  return a.serviceId === (b as { readonly level: 'internal'; readonly serviceId: EntityId }).serviceId;
}

function extractScopeGraph(
  project: ArchitectureProject,
  scope: ViewScope,
  measured: Readonly<Record<EntityId, { readonly width: number; readonly height: number }>> | undefined,
): { nodes: LayoutGraphNodeInput[]; edges: LayoutGraphEdgeInput[] } | null {
  if (scope.level === 'system') {
    const nodes: LayoutGraphNodeInput[] = project.topology.nodes.map((n) => {
      const dims = measured && Object.hasOwn(measured, n.id) ? measured[n.id] : undefined;
      return {
        id: n.id,
        width: dims?.width ?? DEFAULT_LAYOUT_NODE_WIDTH,
        height: dims?.height ?? DEFAULT_LAYOUT_NODE_HEIGHT,
      };
    });
    const edges: LayoutGraphEdgeInput[] = project.topology.connections.map((c) => ({
      sourceId: c.sourceId,
      targetId: c.targetId,
    }));
    return { nodes, edges };
  }

  const internal = Object.hasOwn(project.internals, scope.serviceId)
    ? project.internals[scope.serviceId]
    : undefined;
  if (!internal) {
    return null;
  }

  const nodes: LayoutGraphNodeInput[] = internal.units.map((u) => {
    const dims = measured && Object.hasOwn(measured, u.id) ? measured[u.id] : undefined;
    return {
      id: u.id,
      width: dims?.width ?? DEFAULT_LAYOUT_NODE_WIDTH,
      height: dims?.height ?? DEFAULT_LAYOUT_NODE_HEIGHT,
    };
  });
  const edges: LayoutGraphEdgeInput[] = internal.dependencies.map((d) => ({
    sourceId: d.sourceId,
    targetId: d.targetId,
  }));
  return { nodes, edges };
}

export async function applyViewLayout(
  deps: ApplyViewLayoutDeps,
  input: ApplyViewLayoutInput,
): Promise<ApplyViewLayoutResult> {
  const { session } = deps;
  const projectAtStart = session.currentProject;
  if (!projectAtStart) {
    return { status: 'discarded', reason: 'NO_ACTIVE_PROJECT' };
  }

  const graph = extractScopeGraph(projectAtStart, input.scope, input.measuredDimensions);
  if (!graph || graph.nodes.length === 0) {
    return { status: 'discarded', reason: 'EMPTY_SCOPE' };
  }

  const baseMutationSeq = session.mutationSeq;
  const baseScope = input.scope;

  const layoutOutput = await deps.layoutPort.computeLayout(graph, input.signal);

  // Discard stale layout if project mutated (edit / undo / redo) or user navigated to another scope
  if (
    session.currentProject === null ||
    session.mutationSeq !== baseMutationSeq ||
    !isSameScope(deps.getActiveScope(), baseScope)
  ) {
    return { status: 'discarded', reason: 'STALE_MUTATION_OR_SCOPE' };
  }

  const nowIso = (deps.clock ?? (() => new Date().toISOString()))();
  const updated = updateViewNodePositions(
    session.currentProject,
    { scope: baseScope, positions: layoutOutput.positions },
    nowIso,
  );

  if (!updated.ok) {
    return { status: 'discarded', reason: 'INVALID_LAYOUT' };
  }

  session.history.push(session.currentProject);
  session.currentProject = updated.value;
  session.mutationSeq += 1;

  return {
    status: 'applied',
    project: updated.value,
    changedSemantically: false,
    canUndo: session.history.canUndo(),
    canRedo: session.history.canRedo(),
    mutationSeq: session.mutationSeq,
  };
}
