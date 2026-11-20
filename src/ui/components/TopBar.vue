<script setup lang="ts">
import { ref } from 'vue';
import type { ProjectSummary } from '@application/ports/ProjectRepository';
import type { ArchitectureProject, EntityId, RuleProfileId, ViewScope } from '@domain/types';
import { BUILTIN_EXAMPLES } from '@examples/index';
import type { RecoveryBannerState } from '../composables/useWorkspace';

const props = defineProps<{
  project: ArchitectureProject | null;
  projectSummaries: readonly ProjectSummary[];
  activeScope: ViewScope;
  canUndo: boolean;
  canRedo: boolean;
  dirtyFlag: boolean;
  unexportedChangesFlag: boolean;
  isSaving: boolean;
  recoveryBanner: RecoveryBannerState | null;
}>();

const emit = defineEmits<{
  createProject: [name: string];
  openProject: [id: EntityId];
  openExample: [exampleId: string];
  deleteProject: [];
  navigateSystem: [];
  changeRuleProfile: [profile: RuleProfileId];
  undo: [];
  redo: [];
  applyLayout: [];
  importFile: [file: File];
  exportJson: [];
  exportDiagnostics: [includeProject: boolean];
  reloadFromDb: [];
  downloadEmergencyJson: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const showDiagModal = ref(false);
const includeProjectInDiag = ref(false);

function getActiveServiceName(): string {
  if (!props.project || props.activeScope.level !== 'internal') return '';
  const serviceId = props.activeScope.serviceId;
  return props.project.topology.nodes.find((n) => n.id === serviceId)?.name ?? serviceId;
}

function handleProjectSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value) emit('openProject', value);
}

function handleExampleSelect(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  if (value) {
    emit('openExample', value);
    select.value = '';
  }
}

function handleProfileChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as RuleProfileId;
  emit('changeRuleProfile', value);
}

function triggerImportClick(): void {
  fileInputRef.value?.click();
}

function handleFileChosen(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit('importFile', file);
    input.value = '';
  }
}

function handleCreatePrompt(): void {
  const name = window.prompt('Nome do novo projeto:', 'Novo Sistema');
  if (name !== null && name.trim().length > 0) {
    emit('createProject', name.trim());
  }
}

function confirmExportDiagnostics(): void {
  emit('exportDiagnostics', includeProjectInDiag.value);
  showDiagModal.value = false;
  includeProjectInDiag.value = false;
}
</script>

<template>
  <header class="ff-topbar">
    <div class="ff-topbar__row">
      <div class="ff-topbar__group">
        <strong class="ff-brand">Flow-Forge</strong>

        <select
          v-if="projectSummaries.length > 0"
          aria-label="Selecionar projeto local"
          data-testid="project-selector"
          :value="project?.id ?? ''"
          @change="handleProjectSelect"
        >
          <option v-if="!project" value="">Selecione um projeto…</option>
          <option v-for="summary in projectSummaries" :key="summary.id" :value="summary.id">
            {{ summary.name }}
          </option>
        </select>

        <button data-testid="btn-new-project" @click="handleCreatePrompt">+ Novo</button>

        <select
          aria-label="Abrir modelo de exemplo"
          data-testid="example-selector"
          @change="handleExampleSelect"
        >
          <option value="">Exemplos…</option>
          <option v-for="ex in BUILTIN_EXAMPLES" :key="ex.id" :value="ex.id">
            {{ ex.title }}
          </option>
        </select>
      </div>

      <nav v-if="project" class="ff-breadcrumbs" aria-label="Navegação hierárquica">
        <button
          class="ff-crumb"
          :class="{ active: activeScope.level === 'system' }"
          data-testid="breadcrumb-system"
          @click="emit('navigateSystem')"
        >
          Topologia
        </button>
        <template v-if="activeScope.level === 'internal'">
          <span class="ff-crumb-sep">&gt;</span>
          <span class="ff-crumb active" data-testid="breadcrumb-service">
            {{ getActiveServiceName() }}
          </span>
        </template>
      </nav>

      <div v-if="project" class="ff-topbar__group">
        <label class="ff-inline-label">
          Perfil:
          <select
            data-testid="rule-profile-select"
            :value="project.ruleProfile"
            @change="handleProfileChange"
          >
            <option value="hexagonal">Hexagonal</option>
            <option value="layered">Camadas (Layered)</option>
            <option value="distributed-baseline">Baseline Distribuído</option>
          </select>
        </label>

        <button :disabled="!canUndo" data-testid="btn-undo" title="Desfazer (Ctrl+Z)" @click="emit('undo')">
          ↶ Undo
        </button>
        <button
          :disabled="!canRedo"
          data-testid="btn-redo"
          title="Refazer (Ctrl+Shift+Z)"
          @click="emit('redo')"
        >
          ↷ Redo
        </button>
        <button data-testid="btn-layout" @click="emit('applyLayout')">Organizar layout</button>

        <button data-testid="btn-import" @click="triggerImportClick">Importar JSON</button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="sr-only"
          data-testid="file-import-input"
          @change="handleFileChosen"
        />

        <button data-testid="btn-export" class="primary" @click="emit('exportJson')">
          Exportar JSON
          <span
            v-if="unexportedChangesFlag"
            class="ff-dot"
            title="Há alterações locais ainda não exportadas para JSON"
          />
        </button>

        <button title="Exportar diagnóstico local" @click="showDiagModal = true">Log</button>
        <button class="danger" title="Excluir projeto atual" @click="emit('deleteProject')">✕</button>

        <span class="ff-save-indicator" data-testid="save-status">
          {{ isSaving ? 'Salvando…' : dirtyFlag ? 'Pendente' : 'Salvo' }}
        </span>
      </div>
    </div>

    <div
      v-if="recoveryBanner"
      class="ff-recovery-banner"
      role="alert"
      data-testid="recovery-banner"
    >
      <span><strong>Atenção:</strong> {{ recoveryBanner.message }}</span>
      <div class="ff-topbar__group">
        <button data-testid="btn-recovery-reload" @click="emit('reloadFromDb')">
          Recarregar do IndexedDB
        </button>
        <button class="primary" data-testid="btn-recovery-download" @click="emit('downloadEmergencyJson')">
          Baixar JSON da memória
        </button>
      </div>
    </div>

    <div v-if="showDiagModal" class="ff-modal-backdrop" role="dialog" aria-modal="true">
      <div class="ff-modal">
        <h3>Exportar Diagnóstico Local</h3>
        <p>
          O log local registra apenas códigos de evento, durações e contagens numéricas (sem nomes ou
          descrições autorais).
        </p>
        <label class="ff-checkbox">
          <input v-model="includeProjectInDiag" type="checkbox" />
          Anexar o JSON completo do projeto atual (opt-in explícito)
        </label>
        <div class="ff-modal__actions">
          <button @click="showDiagModal = false">Cancelar</button>
          <button class="primary" @click="confirmExportDiagnostics">Baixar Diagnóstico</button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.ff-topbar {
  background: var(--ff-surface);
  border-bottom: 1px solid var(--ff-border);
  z-index: 20;
}

.ff-topbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
}

.ff-topbar__group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ff-brand {
  font-size: 15px;
  margin-right: 6px;
  color: var(--ff-primary);
}

.ff-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.ff-crumb {
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-weight: 500;
  color: var(--ff-muted);
}

.ff-crumb.active {
  color: var(--ff-text);
  font-weight: 700;
}

.ff-crumb-sep {
  color: var(--ff-muted);
}

.ff-inline-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ff-muted);
}

.ff-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fde047;
  margin-left: 4px;
}

.ff-save-indicator {
  font-size: 11px;
  color: var(--ff-muted);
  min-width: 56px;
  text-align: right;
}

.ff-recovery-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: var(--ff-error-bg);
  border-top: 1px solid #fecaca;
  color: #991b1b;
  font-size: 13px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.ff-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.ff-modal {
  background: var(--ff-surface);
  border-radius: 10px;
  padding: 18px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
}

.ff-modal h3 {
  margin: 0 0 8px;
}

.ff-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  font-size: 13px;
}

.ff-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
