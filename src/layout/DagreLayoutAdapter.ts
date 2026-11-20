import dagre from '@dagrejs/dagre';
import type {
  LayoutGraphInput,
  LayoutGraphOutput,
  LayoutPort,
} from '@application/ports/LayoutPort';
import type { EntityId, Point2D } from '@domain/types';

export class DagreLayoutAdapter implements LayoutPort {
  async computeLayout(
    input: LayoutGraphInput,
    signal?: AbortSignal,
  ): Promise<LayoutGraphOutput> {
    if (signal?.aborted) {
      throw new DOMException('Layout computation aborted', 'AbortError');
    }

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: 'LR',
      nodesep: 92,
      ranksep: 190,
      edgesep: 36,
      marginx: 48,
      marginy: 48,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    const paddingX = 20;
    const paddingY = 28;

    for (const node of input.nodes) {
      graph.setNode(node.id, {
        width: node.width + paddingX,
        height: node.height + paddingY,
      });
    }
    for (const edge of input.edges) {
      graph.setEdge(edge.sourceId, edge.targetId);
    }

    dagre.layout(graph);

    const positions: Record<EntityId, Point2D> = {};
    for (const node of input.nodes) {
      const laidOut = graph.node(node.id);
      positions[node.id] = {
        x: Math.round(laidOut.x - node.width / 2),
        y: Math.round(laidOut.y - node.height / 2),
      };
    }

    return { positions };
  }
}
