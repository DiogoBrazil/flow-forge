<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue';
import { Background, Controls, VueFlow } from '@xyflow/vue';
import type { NodeTypesObject } from '@xyflow/vue';
import { Link2, X } from 'lucide-vue-next';
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

const connectingFromName = ref<string | null>(null);
const dismissedHint = ref(false);

const showConnectionHint = computed(
  () =>
    !dismissedHint.value &&
    !connectingFromName.value &&
    viewModel.value.nodes.length >= 2 &&
    viewModel.value.edges.length === 0,
);

function handleConnectStart(event: { nodeId?: string | null }): void {
  const nodeId = event.nodeId;
  if (!nodeId) {
    connectingFromName.value = 'nó de origem';
    return;
  }
  const node = viewModel.value.nodes.find((n) => n.id === nodeId);
  connectingFromName.value = node?.label ?? nodeId;
}

function handleConnectEnd(): void {
  connectingFromName.value = null;
}

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
    <div v-if="connectingFromName" class="ff-canvas-banner ff-canvas-banner--active" role="status">
      <Link2 :size="15" />
      <span v-if="activeScope.level === 'system'">
        Conectando <strong>{{ connectingFromName }}</strong> → solte no conector esquerdo (●) do
        destino (<em>A chama / acessa B</em>)
      </span>
      <span v-else>
        Conectando <strong>{{ connectingFromName }}</strong> → solte no conector esquerdo (●) do
        destino (<em>A depende de / implementa B</em>)
      </span>
    </div>

    <div
      v-else-if="showConnectionHint"
      class="ff-canvas-banner ff-canvas-banner--hint"
      data-testid="connection-hint"
    >
      <Link2 :size="14" />
      <span>
        Para ligar dois cards, arraste do <strong>ponto azul à direita</strong> até o ponto à
        esquerda do destino — ou selecione um card e use <strong>"+ Conectar a…"</strong> no
        Inspetor.
      </span>
      <button
        type="button"
        class="ghost icon-btn"
        aria-label="Dispensar dica"
        @click="dismissedHint = true"
      >
        <X :size="13" />
      </button>
    </div>

    <VueFlow
      :nodes="adapter.localNodes.value"
      :edges="adapter.localEdges.value"
      :node-types="nodeTypes"
      :delete-key-code="null"
      @nodes-change="adapter.handleNodesChange"
      @node-drag-start="adapter.handleNodeDragStart"
      @node-drag-stop="adapter.handleNodeDragStop"
      @connect="adapter.handleConnect"
      @connect-start="handleConnectStart"
      @connect-end="handleConnectEnd"
      @node-click="adapter.handleNodeClick"
      @node-double-click="adapter.handleNodeDoubleClick"
      @edge-click="adapter.handleEdgeClick"
      @pane-click="adapter.handlePaneClick"
    >
      <Background :gap="20" />
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
  background: var(--ff-canvas-bg);
}

.ff-canvas-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 15;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  box-shadow: var(--ff-shadow-md);
  max-width: calc(100% - 32px);
}

.ff-canvas-banner--active {
  background: var(--ff-primary);
  color: #ffffff;
}

.ff-canvas-banner--hint {
  background: var(--ff-surface-elevated);
  border: 1px solid var(--ff-border-strong);
  color: var(--ff-text-secondary);
}
</style>
