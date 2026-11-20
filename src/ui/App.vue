<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
  X,
} from 'lucide-vue-next';
import type { CodeUnitKind, EntityId, Point2D, RuleProfileId, SystemNodeKind } from '@domain/types';
import { BUILTIN_EXAMPLES } from '@examples/index';
import type { Diagnostic } from '@rules/types';
import { inferConnectionDefaults, useWorkspace } from './composables/useWorkspace';
import ArchitectureCanvas from './components/ArchitectureCanvas.vue';
import DiagnosticsPanel from './components/DiagnosticsPanel.vue';
import ElementPalette from './components/ElementPalette.vue';
import ImportConflictModal from './components/ImportConflictModal.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import NewProjectModal from './components/NewProjectModal.vue';
import TopBar from './components/TopBar.vue';

const ws = useWorkspace();
const canvasRef = ref<InstanceType<typeof ArchitectureCanvas> | null>(null);
const showNewProjectModal = ref(false);
const showPalette = ref(true);
const showInspector = ref(true);

function triggerDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleCreateProjectSubmit(name: string, ruleProfile: RuleProfileId): Promise<void> {
  showNewProjectModal.value = false;
  await ws.createNewProject(name, ruleProfile);
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
  showInspector.value = true;
}

function handleEdgeSelected(edgeId: EntityId): void {
  ws.selectedElement.value =
    ws.activeScope.value.level === 'system'
      ? { kind: 'runtime-connection', id: edgeId }
      : { kind: 'static-dependency', id: edgeId };
  showInspector.value = true;
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
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    showPalette.value = false;
  }
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
      :show-palette="showPalette"
      :show-inspector="showInspector"
      @open-new-project="showNewProjectModal = true"
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
      @toggle-palette="showPalette = !showPalette"
      @toggle-inspector="showInspector = !showInspector"
    />

    <div v-if="ws.lastError.value" class="ff-toast-error" role="alert">
      <span class="ff-toast-error__msg">
        <AlertTriangle :size="15" />
        {{ ws.lastError.value }}
      </span>
      <button type="button" class="ghost icon-btn" aria-label="Fechar aviso" @click="ws.lastError.value = null">
        <X :size="14" />
      </button>
    </div>

    <div v-if="ws.project.value" class="ff-workspace">
      <div class="ff-workspace__main">
        <ElementPalette
          v-if="showPalette"
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
          v-if="showInspector"
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
      <div class="ff-welcome__container">
        <div class="ff-welcome__hero">
          <div class="ff-welcome__badge">
            <Layers :size="14" />
            <span>Local-First Architecture Studio</span>
          </div>
          <h1>Flow-Forge</h1>
          <p>
            Modele topologias distribuídas e arquiteturas internas em dois níveis integrados com
            validação estrutural determinística — 100% no navegador.
          </p>
          <div class="ff-welcome__cta">
            <button
              type="button"
              class="primary ff-btn-lg"
              data-testid="welcome-new-project"
              @click="showNewProjectModal = true"
            >
              <Plus :size="16" />
              Novo Projeto
            </button>
            <button
              type="button"
              class="ff-btn-lg"
              data-testid="welcome-open-example"
              @click="ws.openExample('hexagonal-orders-valid')"
            >
              <Sparkles :size="15" />
              Abrir Exemplo (Pedidos Hexagonal)
            </button>
            <button
              type="button"
              class="ff-btn-lg"
              data-testid="welcome-open-defective"
              @click="ws.openExample('hexagonal-orders-defective')"
            >
              Abrir Exemplo com Defeitos
            </button>
          </div>
        </div>

        <div v-if="ws.projectSummaries.value.length > 0" class="ff-welcome__section">
          <h3>
            <FolderKanban :size="15" />
            Projetos Salvos Localmente
          </h3>
          <div class="ff-card-grid">
            <button
              v-for="summary in ws.projectSummaries.value"
              :key="summary.id"
              type="button"
              class="ff-welcome-card"
              @click="ws.openExistingProject(summary.id)"
            >
              <strong>{{ summary.name }}</strong>
              <small>Revisão {{ summary.persistedRevision }}</small>
            </button>
          </div>
        </div>

        <div class="ff-welcome__section">
          <h3>
            <Sparkles :size="15" />
            Modelos de Referência Prontos
          </h3>
          <div class="ff-card-grid">
            <button
              v-for="ex in BUILTIN_EXAMPLES"
              :key="ex.id"
              type="button"
              class="ff-welcome-card"
              @click="ws.openExample(ex.id)"
            >
              <div class="ff-welcome-card__head">
                <strong>{{ ex.title }}</strong>
                <ArrowRight :size="14" class="ff-welcome-card__arrow" />
              </div>
              <p>{{ ex.description }}</p>
            </button>
          </div>
        </div>
      </div>
    </section>

    <NewProjectModal
      :open="showNewProjectModal"
      @close="showNewProjectModal = false"
      @submit="handleCreateProjectSubmit"
    />

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
  padding: 7px 14px;
  background: var(--ff-error-bg);
  color: var(--ff-error);
  border-bottom: 1px solid var(--ff-error-border);
  font-size: 12.5px;
}

.ff-toast-error__msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  position: relative;
}

.ff-welcome {
  flex: 1;
  overflow-y: auto;
  padding: 36px 24px 48px;
  display: flex;
  justify-content: center;
}

.ff-welcome__container {
  width: 100%;
  max-width: 920px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.ff-welcome__hero {
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  border-radius: var(--ff-radius-lg);
  padding: 32px;
  text-align: center;
  box-shadow: var(--ff-shadow-md);
}

.ff-welcome__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ff-primary-text);
  background: var(--ff-primary-soft);
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 12px;
}

.ff-welcome__hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  letter-spacing: -0.02em;
}

.ff-welcome__hero p {
  margin: 0 auto 22px;
  max-width: 600px;
  color: var(--ff-muted);
  font-size: 14.5px;
  line-height: 1.55;
}

.ff-welcome__cta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.ff-btn-lg {
  padding: 9px 16px;
  font-size: 13.5px;
  border-radius: 8px;
}

.ff-welcome__section h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ff-muted);
}

.ff-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.ff-welcome-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 6px;
  padding: 16px;
  border-radius: var(--ff-radius-md);
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
  box-shadow: var(--ff-shadow-sm);
}

.ff-welcome-card:hover {
  border-color: var(--ff-primary);
  box-shadow: var(--ff-shadow-md);
}

.ff-welcome-card__head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ff-welcome-card__arrow {
  color: var(--ff-muted);
  flex-shrink: 0;
}

.ff-welcome-card p {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--ff-muted);
  line-height: 1.45;
}

.ff-welcome-card small {
  color: var(--ff-muted);
  font-size: 11.5px;
}
</style>
