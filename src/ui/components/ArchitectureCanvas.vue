<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted } from 'vue';
import { Background, Controls, VueFlow } from '@xyflow/vue';
import type { NodeTypesObject } from '@xyflow/vue';
import { projectToDiagramViewModel } from '@diagram-adapter/projection';
import { useVueFlowAdapter } from '@diagram-adapter/useVueFlowAdapter';
import type { ArchFlowNode } from '@diagram-adapter/useVueFlowAdapter';
import type { ArchitectureProject, EntityId, Point2D, ViewScope } from '@domain/types';
import type { Diagnostic } from '@rules/types';
import ArchNodeCard from './ArchNodeCard.vue';

const props = defineProps<{
  project: ArchitectureProject;
  activeScope: ViewScope;
  diagnostics: readonly Diagnostic[];
  highlightedIds: ReadonlySet<EntityId>;
}>();

const emit = defineEmits<{
  nodePositionCommitted: [nodeId: EntityId, position: Point2D];
  connectRequested: [sourceId: EntityId, targetId: EntityId];
  nodeSelected: [nodeId: EntityId];
  edgeSelected: [edgeId: EntityId];
  paneSelected: [];
  nodeDrillDown: [nodeId: EntityId];
  undoShortcut: [];
  redoShortcut: [];
  deleteShortcut: [];
}>();

const nodeTypes: NodeTypesObject<ArchFlowNode> = {
  arch: markRaw(ArchNodeCard),
};

const viewModel = computed(() =>
  projectToDiagramViewModel(
    props.project,
    props.activeScope,
    props.diagnostics,
    props.highlightedIds,
  ),
);

const adapter = useVueFlowAdapter(viewModel, {
  onNodePositionCommitted: (nodeId, position) => emit('nodePositionCommitted', nodeId, position),
  onConnectRequested: (sourceId, targetId) => emit('connectRequested', sourceId, targetId),
  onNodeSelected: (nodeId) => emit('nodeSelected', nodeId),
  onEdgeSelected: (edgeId) => emit('edgeSelected', edgeId),
  onPaneSelected: () => emit('paneSelected'),
  onNodeDrillDown: (nodeId) => emit('nodeDrillDown', nodeId),
});

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable === true;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (isEditableElement(document.activeElement)) return;

  const isMod = event.ctrlKey || event.metaKey;
  if (isMod && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      emit('redoShortcut');
    } else {
      emit('undoShortcut');
    }
    return;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    emit('deleteShortcut');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

defineExpose({
  getMeasuredDimensions: adapter.getMeasuredDimensions,
  focusNodes: adapter.focusNodes,
  fitView: adapter.fitView,
});
</script>

<template>
  <main class="ff-canvas" data-testid="architecture-canvas">
    <VueFlow
      :nodes="adapter.localNodes.value"
      :edges="adapter.localEdges.value"
      :node-types="nodeTypes"
      :delete-key-code="null"
      @nodes-change="adapter.handleNodesChange"
      @node-drag-start="adapter.handleNodeDragStart"
      @node-drag-stop="adapter.handleNodeDragStop"
      @connect="adapter.handleConnect"
      @node-click="adapter.handleNodeClick"
      @node-double-click="adapter.handleNodeDoubleClick"
      @edge-click="adapter.handleEdgeClick"
      @pane-click="adapter.handlePaneClick"
    >
      <Background />
      <Controls />
    </VueFlow>
  </main>
</template>

<style scoped>
.ff-canvas {
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
  background: #f8fafc;
}
</style>
