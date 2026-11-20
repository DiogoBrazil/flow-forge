<script setup lang="ts">
import { ref } from 'vue';
import {
  AlertTriangle,
  ChevronRight,
  Download,
  FileJson2,
  Layers,
  LayoutGrid,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Sun,
  Terminal,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-vue-next';
import type { ProjectSummary } from '@application/ports/ProjectRepository';
import type { ArchitectureProject, EntityId, RuleProfileId, ViewScope } from '@domain/types';
import { BUILTIN_EXAMPLES } from '@examples/index';
import { useColorScheme } from '../composables/useColorScheme';
import type { RecoveryBannerState } from '../composables/useWorkspace';
import AppDialog from './AppDialog.vue';

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
  showPalette: boolean;
  showInspector: boolean;
}>();

const emit = defineEmits<{
  openNewProject: [];
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
  togglePalette: [];
  toggleInspector: [];
}>();

const { resolvedScheme, toggleColorScheme } = useColorScheme();

const fileInputRef = ref<HTMLInputElement | null>(null);
const showDiagModal = ref(false);
const showDeleteModal = ref(false);
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

function confirmExportDiagnostics(): void {
  emit('exportDiagnostics', includeProjectInDiag.value);
  showDiagModal.value = false;
  includeProjectInDiag.value = false;
}

function confirmDeleteProject(): void {
  showDeleteModal.value = false;
  emit('deleteProject');
}
</script>

<template>
  <header class="ff-topbar">
    <div class="ff-topbar__row">
      <!-- Left: Brand + Project Switcher -->
      <div class="ff-topbar__group">
        <div class="ff-brand">
          <span class="ff-brand__mark">
            <Layers :size="16" />
          </span>
          <strong>Flow-Forge</strong>
        </div>

        <button
          v-if="project"
          type="button"
          class="ghost icon-btn"
          :class="{ 'is-active': showPalette }"
          title="Alternar paleta lateral"
          aria-label="Alternar paleta lateral"
          @click="emit('togglePalette')"
        >
          <PanelLeft :size="16" />
        </button>

        <select
          v-if="projectSummaries.length > 0"
          aria-label="Selecionar projeto local"
          data-testid="project-selector"
          class="ff-select-compact"
          :value="project?.id ?? ''"
          @change="handleProjectSelect"
        >
          <option v-if="!project" value="">Projetos locais…</option>
          <option v-for="summary in projectSummaries" :key="summary.id" :value="summary.id">
            {{ summary.name }}
          </option>
        </select>

        <button type="button" data-testid="btn-new-project" @click="emit('openNewProject')">
          <Plus :size="14" />
          <span class="ff-hide-sm">Novo</span>
        </button>

        <select
          aria-label="Abrir modelo de exemplo"
          data-testid="example-selector"
          class="ff-select-compact"
          @change="handleExampleSelect"
        >
          <option value="">Exemplos…</option>
          <option v-for="ex in BUILTIN_EXAMPLES" :key="ex.id" :value="ex.id">
            {{ ex.title }}
          </option>
        </select>
      </div>

      <!-- Center: Hierarchical Breadcrumbs -->
      <nav v-if="project" class="ff-breadcrumbs" aria-label="Navegação hierárquica">
        <button
          type="button"
          class="ff-crumb"
          :class="{ active: activeScope.level === 'system' }"
          data-testid="breadcrumb-system"
          @click="emit('navigateSystem')"
        >
          Topologia
        </button>
        <template v-if="activeScope.level === 'internal'">
          <ChevronRight :size="14" class="ff-crumb-sep" />
          <span class="ff-crumb active" data-testid="breadcrumb-service">
            {{ getActiveServiceName() }}
          </span>
        </template>
      </nav>

      <!-- Right: Workspace Actions + Theme Toggle -->
      <div class="ff-topbar__group">
        <template v-if="project">
          <select
            aria-label="Perfil de regras arquiteturais"
            data-testid="rule-profile-select"
            class="ff-select-compact"
            :value="project.ruleProfile"
            @change="handleProfileChange"
          >
            <option value="hexagonal">Hexagonal</option>
            <option value="layered">Camadas</option>
            <option value="distributed-baseline">Baseline</option>
          </select>

          <div class="ff-btn-group">
            <button
              type="button"
              class="icon-btn"
              :disabled="!canUndo"
              data-testid="btn-undo"
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
              @click="emit('undo')"
            >
              <Undo2 :size="15" />
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="!canRedo"
              data-testid="btn-redo"
              title="Refazer (Ctrl+Shift+Z)"
              aria-label="Refazer"
              @click="emit('redo')"
            >
              <Redo2 :size="15" />
            </button>
          </div>

          <button
            type="button"
            data-testid="btn-layout"
            title="Organizar layout da visão ativa"
            @click="emit('applyLayout')"
          >
            <LayoutGrid :size="14" />
            <span class="ff-hide-md">Organizar layout</span>
          </button>

          <button type="button" data-testid="btn-import" title="Importar JSON v1" @click="triggerImportClick">
            <Upload :size="14" />
            <span class="ff-hide-lg">Importar</span>
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="sr-only"
            data-testid="file-import-input"
            @change="handleFileChosen"
          />

          <button
            type="button"
            data-testid="btn-export"
            class="primary"
            title="Exportar projeto em JSON v1"
            @click="emit('exportJson')"
          >
            <Download :size="14" />
            <span class="ff-hide-md">Exportar</span>
            <span
              v-if="unexportedChangesFlag"
              class="ff-dot"
              title="Há alterações locais ainda não exportadas para JSON"
            />
          </button>

          <button
            type="button"
            class="ghost icon-btn"
            title="Exportar diagnóstico local"
            aria-label="Exportar diagnóstico local"
            @click="showDiagModal = true"
          >
            <Terminal :size="15" />
          </button>

          <button
            type="button"
            class="danger icon-btn"
            title="Excluir projeto atual"
            aria-label="Excluir projeto atual"
            @click="showDeleteModal = true"
          >
            <Trash2 :size="15" />
          </button>

          <span
            class="ff-save-pill"
            :class="{ 'is-dirty': dirtyFlag || isSaving }"
            data-testid="save-status"
          >
            {{ isSaving ? 'Salvando…' : dirtyFlag ? 'Pendente' : 'Salvo' }}
          </span>

          <button
            type="button"
            class="ghost icon-btn"
            :class="{ 'is-active': showInspector }"
            title="Alternar painel inspetor"
            aria-label="Alternar painel inspetor"
            @click="emit('toggleInspector')"
          >
            <PanelRight :size="16" />
          </button>
        </template>

        <button
          type="button"
          class="ghost icon-btn"
          data-testid="btn-theme-toggle"
          :title="resolvedScheme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'"
          :aria-label="resolvedScheme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'"
          @click="toggleColorScheme"
        >
          <Sun v-if="resolvedScheme === 'dark'" :size="16" />
          <Moon v-else :size="16" />
        </button>
      </div>
    </div>

    <div
      v-if="recoveryBanner"
      class="ff-recovery-banner"
      role="alert"
      data-testid="recovery-banner"
    >
      <span class="ff-recovery-banner__msg">
        <AlertTriangle :size="16" />
        <span><strong>Atenção:</strong> {{ recoveryBanner.message }}</span>
      </span>
      <div class="ff-topbar__group">
        <button type="button" data-testid="btn-recovery-reload" @click="emit('reloadFromDb')">
          Recarregar do IndexedDB
        </button>
        <button
          type="button"
          class="primary"
          data-testid="btn-recovery-download"
          @click="emit('downloadEmergencyJson')"
        >
          <FileJson2 :size="14" />
          Baixar JSON da memória
        </button>
      </div>
    </div>

    <!-- Diagnostics export dialog -->
    <AppDialog
      :open="showDiagModal"
      title="Exportar Diagnóstico Local"
      @close="showDiagModal = false"
    >
      <p class="ff-dialog-text">
        O log local registra apenas códigos de evento, durações e contagens numéricas (sem nomes ou
        descrições autorais).
      </p>
      <label class="ff-checkbox">
        <input v-model="includeProjectInDiag" type="checkbox" />
        Anexar o JSON completo do projeto atual (opt-in explícito)
      </label>
      <template #actions>
        <button type="button" @click="showDiagModal = false">Cancelar</button>
        <button type="button" class="primary" @click="confirmExportDiagnostics">
          Baixar Diagnóstico
        </button>
      </template>
    </AppDialog>

    <!-- Delete project confirmation dialog -->
    <AppDialog
      :open="showDeleteModal"
      title="Excluir Projeto Local"
      @close="showDeleteModal = false"
    >
      <p class="ff-dialog-text">
        Tem certeza que deseja excluir o projeto <strong>{{ project?.name }}</strong> do
        armazenamento local (IndexedDB)? Esta ação não pode ser desfeita.
      </p>
      <template #actions>
        <button type="button" @click="showDeleteModal = false">Cancelar</button>
        <button type="button" class="danger" @click="confirmDeleteProject">Excluir Projeto</button>
      </template>
    </AppDialog>
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
  gap: 8px 12px;
  padding: 8px 14px;
  min-height: 52px;
}

.ff-topbar__group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ff-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
  font-size: 14.5px;
  letter-spacing: -0.01em;
}

.ff-brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--ff-primary);
  color: #ffffff;
}

.ff-select-compact {
  max-width: 170px;
  text-overflow: ellipsis;
}

.ff-btn-group {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--ff-surface-subtle);
  border: 1px solid var(--ff-border);
}

.ff-btn-group button {
  border-color: transparent;
  background: transparent;
}

.is-active {
  background: var(--ff-primary-soft) !important;
  color: var(--ff-primary-text) !important;
}

.ff-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ff-surface-subtle);
  border: 1px solid var(--ff-border);
  font-size: 12.5px;
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

.ff-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fde047;
}

.ff-save-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--ff-success-bg);
  color: var(--ff-success);
}

.ff-save-pill.is-dirty {
  background: var(--ff-warning-bg);
  color: var(--ff-warning);
}

.ff-recovery-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 14px;
  background: var(--ff-error-bg);
  border-top: 1px solid var(--ff-error-border);
  color: var(--ff-error);
  font-size: 13px;
}

.ff-recovery-banner__msg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ff-dialog-text {
  margin: 0 0 12px;
}

.ff-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ff-text);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 1280px) {
  .ff-hide-lg {
    display: none;
  }
}

@media (max-width: 1024px) {
  .ff-hide-md {
    display: none;
  }
}

@media (max-width: 768px) {
  .ff-hide-sm {
    display: none;
  }
}
</style>
