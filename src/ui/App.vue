<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CodeUnitKind, EntityId, Point2D, SystemNodeKind } from '@domain/types';
import type { Diagnostic } from '@rules/types';
import { inferConnectionDefaults, useWorkspace } from './composables/useWorkspace';
import ArchitectureCanvas from './components/ArchitectureCanvas.vue';
import DiagnosticsPanel from './components/DiagnosticsPanel.vue';
import ElementPalette from './components/ElementPalette.vue';
import ImportConflictModal from './components/ImportConflictModal.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import TopBar from './components/TopBar.vue';

const ws = useWorkspace();
const canvasRef = ref<InstanceType<typeof ArchitectureCanvas> | null>(null);

function triggerDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function handleAddSystemNode(kind: SystemNodeKind, defaultName: string): void {
  ws.dispatchEdit({
    type: 'addSystemNode',
    payload: {
      name: defaultName,
      kind,
      position: ws.computeNextGridPosition(),
    },
  });
}

function handleAddCodeUnit(kind: CodeUnitKind, defaultName: string): void {
  if (ws.activeScope.value.level !== 'internal') return;
  ws.dispatchEdit({
    type: 'addCodeUnit',
    payload: {
      serviceId: ws.activeScope.value.serviceId,
      name: defaultName,
      kind,
      position: ws.computeNextGridPosition(),
    },
  });
}

function handleNodePositionCommitted(nodeId: EntityId, position: Point2D): void {
  ws.dispatchEdit({
    type: 'updateViewNodePositions',
    payload: {
      scope: ws.activeScope.value,
      positions: { [nodeId]: position },
    },
  });
}

function handleConnectRequested(sourceId: EntityId, targetId: EntityId): void {
  const current = ws.project.value;
  if (!current) return;

  if (ws.activeScope.value.level === 'system') {
    const srcNode = current.topology.nodes.find((n) => n.id === sourceId);
    const tgtNode = current.topology.nodes.find((n) => n.id === targetId);
    const defaults = inferConnectionDefaults(srcNode?.kind, tgtNode?.kind);
    ws.dispatchEdit({
      type: 'addRuntimeConnection',
      payload: {
        sourceId,
        targetId,
        kind: defaults.kind,
        protocol: defaults.protocol,
      },
    });
    return;
  }

  const serviceId = ws.activeScope.value.serviceId;
  const internal = current.internals[serviceId];
  const srcUnit = internal?.units.find((u) => u.id === sourceId);
  const tgtUnit = internal?.units.find((u) => u.id === targetId);
  const isAdapterToInterface =
    (srcUnit?.kind === 'inbound-adapter' || srcUnit?.kind === 'outbound-adapter') &&
    tgtUnit?.kind === 'interface';

  ws.dispatchEdit({
    type: 'addStaticDependency',
    payload: {
      serviceId,
      sourceId,
      targetId,
      kind: isAdapterToInterface ? 'implements' : 'depends-on',
    },
  });
}

function handleNodeSelected(nodeId: EntityId): void {
  ws.selectedElement.value =
    ws.activeScope.value.level === 'system'
      ? { kind: 'system-node', id: nodeId }
      : { kind: 'code-unit', id: nodeId };
}

function handleEdgeSelected(edgeId: EntityId): void {
  ws.selectedElement.value =
    ws.activeScope.value.level === 'system'
      ? { kind: 'runtime-connection', id: edgeId }
      : { kind: 'static-dependency', id: edgeId };
}

function handleDeleteShortcut(): void {
  const sel = ws.selectedElement.value;
  if (!sel) return;
  if (sel.kind === 'system-node') {
    ws.dispatchEdit({ type: 'deleteSystemNode', payload: { id: sel.id } });
  } else if (sel.kind === 'runtime-connection') {
    ws.dispatchEdit({ type: 'deleteRuntimeConnection', payload: { id: sel.id } });
  } else if (sel.kind === 'code-unit' && ws.activeScope.value.level === 'internal') {
    ws.dispatchEdit({
      type: 'deleteCodeUnit',
      payload: { serviceId: ws.activeScope.value.serviceId, id: sel.id },
    });
  } else if (sel.kind === 'static-dependency' && ws.activeScope.value.level === 'internal') {
    ws.dispatchEdit({
      type: 'deleteStaticDependency',
      payload: { serviceId: ws.activeScope.value.serviceId, id: sel.id },
    });
  }
  ws.selectedElement.value = null;
}

async function handleApplyLayout(): Promise<void> {
  const dims = canvasRef.value?.getMeasuredDimensions();
  const applied = await ws.applyLayout(dims);
  if (applied) {
    void canvasRef.value?.fitView();
  }
}

async function handleExportJson(): Promise<void> {
  const exported = await ws.exportCurrentProjectJson();
  if (exported) {
    triggerDownload(exported.fileName, exported.content);
  }
}

function handleDownloadEmergencyJson(): void {
  const exported = ws.exportMemoryEmergencyJson();
  if (exported) {
    triggerDownload(exported.fileName, exported.content);
  }
}

function handleExportDiagnostics(includeProject: boolean): void {
  const content = ws.diagnosticLog.exportJson({
    includeProject,
    project: ws.project.value,
  });
  triggerDownload('flow-forge-diagnostics.json', content);
}

function handleSelectDiagnostic(diag: Diagnostic): void {
  const nodeIds = ws.navigateToDiagnostic(diag);
  setTimeout(() => {
    canvasRef.value?.focusNodes(nodeIds);
  }, 50);
}

onMounted(() => {
  void ws.init();
});
</script>

<template>
  <div class="ff-app">
    <TopBar
      :project="ws.project.value"
      :project-summaries="ws.projectSummaries.value"
      :active-scope="ws.activeScope.value"
      :can-undo="ws.canUndo.value"
      :can-redo="ws.canRedo.value"
      :dirty-flag="ws.dirtyFlag.value"
      :unexported-changes-flag="ws.unexportedChangesFlag.value"
      :is-saving="ws.isSaving.value"
      :recovery-banner="ws.recoveryBanner.value"
      @create-project="ws.createNewProject"
      @open-project="ws.openExistingProject"
      @open-example="ws.openExample"
      @delete-project="ws.deleteActiveProject"
      @navigate-system="ws.navigateToSystem"
      @change-rule-profile="
        (ruleProfile) => ws.dispatchEdit({ type: 'setRuleProfile', payload: { ruleProfile } })
      "
      @undo="ws.undo"
      @redo="ws.redo"
      @apply-layout="handleApplyLayout"
      @import-file="(file) => ws.handleImportFile(file)"
      @export-json="handleExportJson"
      @export-diagnostics="handleExportDiagnostics"
      @reload-from-db="ws.reloadFromIndexedDb"
      @download-emergency-json="handleDownloadEmergencyJson"
    />

    <div v-if="ws.lastError.value" class="ff-toast-error" role="alert">
      <span>{{ ws.lastError.value }}</span>
      <button @click="ws.lastError.value = null">×</button>
    </div>

    <div v-if="ws.project.value" class="ff-workspace">
      <div class="ff-workspace__main">
        <ElementPalette
          :active-scope="ws.activeScope.value"
          @add-system-node="handleAddSystemNode"
          @add-code-unit="handleAddCodeUnit"
        />

        <ArchitectureCanvas
          ref="canvasRef"
          :project="ws.project.value"
          :active-scope="ws.activeScope.value"
          :diagnostics="ws.diagnostics.value"
          :highlighted-ids="ws.highlightedIds.value"
          @node-position-committed="handleNodePositionCommitted"
          @connect-requested="handleConnectRequested"
          @node-selected="handleNodeSelected"
          @edge-selected="handleEdgeSelected"
          @pane-selected="ws.selectedElement.value = null"
          @node-drill-down="ws.enterServiceInternal"
          @undo-shortcut="ws.undo"
          @redo-shortcut="ws.redo"
          @delete-shortcut="handleDeleteShortcut"
        />

        <InspectorPanel
          :project="ws.project.value"
          :active-scope="ws.activeScope.value"
          :selected-element="ws.selectedElement.value"
          @edit="ws.dispatchEdit"
          @drill-down="ws.enterServiceInternal"
          @clear-selection="ws.selectedElement.value = null"
        />
      </div>

      <DiagnosticsPanel
        :diagnostics="ws.diagnostics.value"
        :error-count="ws.errorCount.value"
        :warning-count="ws.warningCount.value"
        @select-diagnostic="handleSelectDiagnostic"
      />
    </div>

    <section v-else class="ff-welcome" data-testid="empty-welcome">
      <div class="ff-welcome__card">
        <h1>Flow-Forge</h1>
        <p>
          Modelagem visual multinível e validação arquitetural determinística (<em>local-first</em>,
          diretamente no navegador).
        </p>
        <div class="ff-welcome__actions">
          <button
            class="primary"
            data-testid="welcome-new-project"
            @click="ws.createNewProject('Meu Sistema')"
          >
            Novo Projeto
          </button>
          <button
            data-testid="welcome-open-example"
            @click="ws.openExample('hexagonal-orders-valid')"
          >
            Abrir Exemplo (Pedidos Hexagonal)
          </button>
          <button
            data-testid="welcome-open-defective"
            @click="ws.openExample('hexagonal-orders-defective')"
          >
            Abrir Exemplo com Defeitos
          </button>
        </div>
      </div>
    </section>

    <ImportConflictModal
      :state="ws.importModal.value"
      @resolve-conflict="ws.resolveImportConflict"
      @close="ws.closeImportModal"
    />
  </div>
</template>

<style scoped>
.ff-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.ff-toast-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--ff-error-bg);
  color: var(--ff-error);
  border-bottom: 1px solid #fecaca;
  font-size: 12px;
}

.ff-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ff-workspace__main {
  flex: 1;
  min-height: 0;
  display: flex;
}

.ff-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.ff-welcome__card {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: 12px;
  padding: 28px 32px;
  max-width: 520px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.ff-welcome__card h1 {
  margin: 0 0 8px;
  color: var(--ff-primary);
}

.ff-welcome__card p {
  margin: 0 0 20px;
  color: var(--ff-muted);
  font-size: 14px;
  line-height: 1.5;
}

.ff-welcome__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
</style>
