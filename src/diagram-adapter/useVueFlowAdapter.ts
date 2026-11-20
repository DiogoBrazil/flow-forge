import { ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { MarkerType, setupVueFlow } from '@xyflow/vue';
import type {
  Connection,
  Edge,
  Node,
  NodeDragEvent,
  NodeMouseEvent,
} from '@xyflow/vue';
import type { EntityId, Point2D } from '@domain/types';
import type {
  DiagramEdgeStyleKind,
  DiagramEdgeViewModel,
  DiagramNodeViewModel,
  DiagramViewModel,
} from './viewModel';

export type ArchFlowNode = Node<DiagramNodeViewModel, 'arch'>;

function toFlowEdge(edge: DiagramEdgeViewModel): Edge {
  const isError = edge.diagnosticSeverity === 'error';
  const isWarning = edge.diagnosticSeverity === 'warning';

  let stroke = 'var(--ff-edge-sync)';
  let strokeDasharray: string | undefined;
  let markerEndType = MarkerType.ArrowClosed;

  const styleKind: DiagramEdgeStyleKind = edge.styleKind;
  switch (styleKind) {
    case 'sync-call':
      stroke = 'var(--ff-edge-sync)';
      break;
    case 'data-access':
      stroke = 'var(--ff-edge-data)';
      break;
    case 'cache-access':
      stroke = 'var(--ff-edge-cache)';
      break;
    case 'async-publish':
      stroke = 'var(--ff-edge-async-pub)';
      strokeDasharray = '6 4';
      break;
    case 'async-consume':
      stroke = 'var(--ff-edge-async-con)';
      strokeDasharray = '6 4';
      break;
    case 'depends-on':
      stroke = 'var(--ff-edge-depends)';
      markerEndType = MarkerType.Arrow;
      break;
    case 'implements':
      stroke = 'var(--ff-edge-implements)';
      strokeDasharray = '2 4';
      markerEndType = MarkerType.ArrowClosed;
      break;
  }

  if (isError) {
    stroke = 'var(--ff-error)';
  } else if (isWarning) {
    stroke = 'var(--ff-warning)';
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: styleKind === 'async-publish' || styleKind === 'async-consume',
    style: {
      stroke,
      strokeWidth: edge.highlighted ? 3 : 2,
      ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
    },
    labelStyle: {
      fill: 'var(--ff-text)',
      fontSize: '11px',
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: 'var(--ff-surface-elevated)',
      fillOpacity: 0.94,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    markerEnd: {
      type: markerEndType,
      color: stroke,
    },
  };
}

function toFlowNode(node: DiagramNodeViewModel): ArchFlowNode {
  return {
    id: node.id,
    type: 'arch',
    position: { x: node.position.x, y: node.position.y },
    data: { ...node },
  };
}

export interface UseVueFlowAdapterCallbacks {
  readonly onNodePositionCommitted: (nodeId: EntityId, position: Point2D) => void;
  readonly onConnectRequested: (sourceId: EntityId, targetId: EntityId) => void;
  readonly onNodeSelected: (nodeId: EntityId) => void;
  readonly onEdgeSelected: (edgeId: EntityId) => void;
  readonly onPaneSelected: () => void;
  readonly onNodeDrillDown: (nodeId: EntityId) => void;
}

export function useVueFlowAdapter(
  viewModel: Ref<DiagramViewModel>,
  callbacks: UseVueFlowAdapterCallbacks,
) {
  // Per Spike 0 finding: use setupVueFlow() directly instead of <VueFlowProvider>
  const flowInstance = setupVueFlow<ArchFlowNode, Edge>();

  const localNodes = shallowRef<ArchFlowNode[]>([]);
  const localEdges = shallowRef<Edge[]>([]);
  const isDragging = ref(false);

  function syncFromViewModel(vm: DiagramViewModel): void {
    if (isDragging.value) return;
    localNodes.value = vm.nodes.map(toFlowNode);
    localEdges.value = vm.edges.map(toFlowEdge);
  }

  watch(viewModel, (vm) => syncFromViewModel(vm), { immediate: true });

  function handleNodesChange(changes: unknown): void {
    if (
      changes &&
      typeof changes === 'object' &&
      'applyTo' in changes &&
      typeof (changes as { applyTo: unknown }).applyTo === 'function'
    ) {
      localNodes.value = (
        changes as { applyTo: (nodes: ArchFlowNode[]) => ArchFlowNode[] }
      ).applyTo(localNodes.value);
    }
  }

  function handleNodeDragStart(_event: NodeDragEvent<ArchFlowNode>): void {
    isDragging.value = true;
  }

  function handleNodeDragStop(event: NodeDragEvent<ArchFlowNode>): void {
    isDragging.value = false;
    const node = event.node;
    // Emit plain Proxy-free Point2D
    callbacks.onNodePositionCommitted(node.id, {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    });
  }

  function handleConnect(connection: Connection): void {
    if (connection.source && connection.target && connection.source !== connection.target) {
      callbacks.onConnectRequested(connection.source, connection.target);
    }
  }

  function handleNodeClick(event: NodeMouseEvent<ArchFlowNode>): void {
    callbacks.onNodeSelected(event.node.id);
  }

  function handleNodeDoubleClick(event: NodeMouseEvent<ArchFlowNode>): void {
    if (event.node.data.drillable) {
      callbacks.onNodeDrillDown(event.node.id);
    }
  }

  function handleEdgeClick(event: { edge: Edge }): void {
    callbacks.onEdgeSelected(event.edge.id);
  }

  function handlePaneClick(): void {
    callbacks.onPaneSelected();
  }

  function getMeasuredDimensions(): Record<EntityId, { readonly width: number; readonly height: number }> {
    const dims: Record<EntityId, { readonly width: number; readonly height: number }> = {};
    for (const node of localNodes.value) {
      const internal = flowInstance.getInternalNode(node.id);
      const width = internal?.measured?.width;
      const height = internal?.measured?.height;
      if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0) {
        dims[node.id] = { width, height };
      }
    }
    return dims;
  }

  function focusNodes(nodeIds: readonly EntityId[]): void {
    if (nodeIds.length === 0) {
      void flowInstance.fitView({ padding: 0.2 });
      return;
    }
    void flowInstance.fitView({
      nodes: nodeIds.map((id) => ({ id })),
      padding: 0.35,
      duration: 250,
    });
  }

  return {
    localNodes,
    localEdges,
    isDragging,
    handleNodesChange,
    handleNodeDragStart,
    handleNodeDragStop,
    handleConnect,
    handleNodeClick,
    handleNodeDoubleClick,
    handleEdgeClick,
    handlePaneClick,
    getMeasuredDimensions,
    focusNodes,
    fitView: () => flowInstance.fitView({ padding: 0.2 }),
  };
}
