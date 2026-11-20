import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { InjectionKey } from 'vue';
import type { AppContainer } from '@application/AppContainer';
import {
  RevisionConflictError,
  StorageQuotaError,
} from '@application/ports/ProjectRepository';
import type { ProjectSummary } from '@application/ports/ProjectRepository';
import type { ArchitectureCommand } from '@application/use-cases/editArchitecture';
import type { ImportConflictStrategy } from '@application/use-cases/importExportProject';
import type {
  ArchitectureProject,
  EntityId,
  Point2D,
  RuleProfileId,
  RuntimeConnectionKind,
  RuntimeProtocol,
  SystemNodeKind,
  ViewScope,
} from '@domain/types';
import { evaluateProject } from '@rules/evaluateProject';
import type { Diagnostic } from '@rules/types';
import { LocalDiagnosticLog, assertDevInvariants } from '../diagnostics/localDiagnosticLog';

export const APP_CONTAINER_KEY: InjectionKey<AppContainer> = Symbol('FlowForgeAppContainer');

export type SelectedElement =
  | { readonly kind: 'system-node'; readonly id: EntityId }
  | { readonly kind: 'runtime-connection'; readonly id: EntityId }
  | { readonly kind: 'code-unit'; readonly id: EntityId }
  | { readonly kind: 'static-dependency'; readonly id: EntityId }
  | null;

export interface RecoveryBannerState {
  readonly kind: 'quota' | 'conflict' | 'storage-error';
  readonly message: string;
}

export interface ImportModalState {
  readonly open: boolean;
  readonly mode: 'conflict' | 'error';
  readonly message: string;
  readonly details: readonly string[];
  readonly existingProjectName?: string;
  readonly pendingFile?: File;
}

export function inferConnectionDefaults(
  sourceKind: SystemNodeKind | undefined,
  targetKind: SystemNodeKind | undefined,
): { readonly kind: RuntimeConnectionKind; readonly protocol: RuntimeProtocol } {
  if (targetKind === 'database') return { kind: 'data-access', protocol: 'sql' };
  if (targetKind === 'cache') return { kind: 'cache-access', protocol: 'redis' };
  if (targetKind === 'broker') return { kind: 'async-publish', protocol: 'kafka' };
  if (sourceKind === 'broker') return { kind: 'async-consume', protocol: 'kafka' };
  return { kind: 'sync-call', protocol: 'http' };
}

export function useWorkspace(explicitContainer?: AppContainer) {
  const resolved = explicitContainer ?? inject(APP_CONTAINER_KEY);
  if (!resolved) {
    throw new Error('AppContainer não foi fornecido via provide(APP_CONTAINER_KEY, container).');
  }
  const container: AppContainer = resolved;

  const diagnosticLog = new LocalDiagnosticLog();

  const project = shallowRef<ArchitectureProject | null>(null);
  const projectSummaries = ref<readonly ProjectSummary[]>([]);
  const activeScope = ref<ViewScope>({ level: 'system' });
  const selectedElement = ref<SelectedElement>(null);
  const highlightedIds = ref<ReadonlySet<EntityId>>(new Set());
  const diagnostics = shallowRef<readonly Diagnostic[]>([]);
  const canUndo = ref(false);
  const canRedo = ref(false);
  const dirtyFlag = ref(false);
  const unexportedChangesFlag = ref(false);
  const isSaving = ref(false);
  const lastError = ref<string | null>(null);
  const recoveryBanner = ref<RecoveryBannerState | null>(null);
  const importModal = ref<ImportModalState>({
    open: false,
    mode: 'error',
    message: '',
    details: [],
  });

  container.setActiveScopeGetter(() => activeScope.value);

  let validationTimer: ReturnType<typeof setTimeout> | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveInFlight: Promise<void> | null = null;
  let pendingSaveAfterFlight = false;

  const errorCount = computed(() => diagnostics.value.filter((d) => d.severity === 'error').length);
  const warningCount = computed(
    () => diagnostics.value.filter((d) => d.severity === 'warning').length,
  );

  function syncHistoryFlags(): void {
    const h = container.getHistoryState();
    canUndo.value = h.canUndo;
    canRedo.value = h.canRedo;
  }

  function runValidationNow(target: ArchitectureProject | null): void {
    if (!target) {
      diagnostics.value = [];
      return;
    }
    const t0 = performance.now();
    diagnostics.value = evaluateProject(target);
    diagnosticLog.record({
      category: 'validation',
      code: 'EVALUATE_PROJECT',
      durationMs: Math.round(performance.now() - t0),
      counts: { diagnostics: diagnostics.value.length },
    });
  }

  function scheduleValidation(): void {
    if (validationTimer) clearTimeout(validationTimer);
    validationTimer = setTimeout(() => {
      validationTimer = null;
      runValidationNow(project.value);
    }, 200);
  }

  async function refreshProjectSummaries(): Promise<void> {
    try {
      projectSummaries.value = await container.listProjects();
    } catch (err) {
      diagnosticLog.record({ category: 'storage', code: 'LIST_FAILED' });
      lastError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function executeSingleFlightSave(): Promise<void> {
    if (!project.value) return;
    if (saveInFlight) {
      pendingSaveAfterFlight = true;
      return saveInFlight;
    }

    isSaving.value = true;
    saveInFlight = (async () => {
      try {
        await container.saveProject();
        dirtyFlag.value = false;
        recoveryBanner.value = null;
        diagnosticLog.record({ category: 'storage', code: 'SAVE_OK' });
        await refreshProjectSummaries();
      } catch (err) {
        if (err instanceof StorageQuotaError) {
          recoveryBanner.value = {
            kind: 'quota',
            message:
              'Espaço de armazenamento local (IndexedDB) excedido. Suas alterações continuam em memória.',
          };
          diagnosticLog.record({ category: 'storage', code: 'QUOTA_EXCEEDED' });
        } else if (err instanceof RevisionConflictError) {
          recoveryBanner.value = {
            kind: 'conflict',
            message:
              'Este projeto foi modificado ou excluído em outra aba. Recarregue do IndexedDB ou baixe o JSON da memória.',
          };
          diagnosticLog.record({ category: 'storage', code: 'REVISION_CONFLICT' });
        } else {
          recoveryBanner.value = {
            kind: 'storage-error',
            message: `Erro ao persistir no IndexedDB: ${err instanceof Error ? err.message : String(err)}`,
          };
          diagnosticLog.record({ category: 'storage', code: 'STORAGE_ERROR' });
        }
      } finally {
        isSaving.value = false;
        saveInFlight = null;
        if (pendingSaveAfterFlight && !recoveryBanner.value) {
          pendingSaveAfterFlight = false;
          await executeSingleFlightSave();
        }
      }
    })();

    return saveInFlight;
  }

  function scheduleAutosave(): void {
    dirtyFlag.value = true;
    unexportedChangesFlag.value = true;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void executeSingleFlightSave();
    }, 600);
  }

  async function flushAutosave(): Promise<void> {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    if (dirtyFlag.value && project.value && !recoveryBanner.value) {
      await executeSingleFlightSave();
    } else if (saveInFlight) {
      await saveInFlight;
    }
  }

  async function init(): Promise<void> {
    await refreshProjectSummaries();
    const first = projectSummaries.value[0];
    if (first) {
      await openExistingProject(first.id);
    }
  }

  async function createNewProject(name: string, ruleProfile: RuleProfileId = 'hexagonal'): Promise<void> {
    await flushAutosave();
    const created = await container.createProject({ name: name.trim() || 'Novo Projeto', ruleProfile });
    project.value = created.project;
    activeScope.value = { level: 'system' };
    selectedElement.value = null;
    highlightedIds.value = new Set();
    dirtyFlag.value = false;
    unexportedChangesFlag.value = false;
    recoveryBanner.value = null;
    syncHistoryFlags();
    runValidationNow(created.project);
    await refreshProjectSummaries();
    diagnosticLog.record({ category: 'lifecycle', code: 'PROJECT_CREATED' });
  }

  async function openExistingProject(projectId: EntityId): Promise<void> {
    await flushAutosave();
    const res = await container.openProject(projectId);
    if (!res.ok) {
      lastError.value = res.message;
      return;
    }
    project.value = res.project;
    activeScope.value = { level: 'system' };
    selectedElement.value = null;
    highlightedIds.value = new Set();
    dirtyFlag.value = false;
    unexportedChangesFlag.value = false;
    recoveryBanner.value = null;
    syncHistoryFlags();
    runValidationNow(res.project);
    diagnosticLog.record({ category: 'lifecycle', code: 'PROJECT_OPENED' });
  }

  async function openExample(exampleId: string): Promise<void> {
    await flushAutosave();
    const res = await container.createProjectFromExample(exampleId);
    if (!res.ok) {
      if (res.code !== 'ID_CONFLICT') {
        lastError.value = res.message;
      }
      return;
    }
    project.value = res.project;
    activeScope.value = { level: 'system' };
    selectedElement.value = null;
    highlightedIds.value = new Set();
    dirtyFlag.value = false;
    unexportedChangesFlag.value = false;
    recoveryBanner.value = null;
    syncHistoryFlags();
    runValidationNow(res.project);
    await refreshProjectSummaries();
    diagnosticLog.record({ category: 'lifecycle', code: 'EXAMPLE_OPENED' });
  }

  async function deleteActiveProject(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    await container.deleteProject(id);
    project.value = null;
    activeScope.value = { level: 'system' };
    selectedElement.value = null;
    diagnostics.value = [];
    dirtyFlag.value = false;
    unexportedChangesFlag.value = false;
    recoveryBanner.value = null;
    syncHistoryFlags();
    await refreshProjectSummaries();
  }

  function dispatchEdit(command: ArchitectureCommand): boolean {
    lastError.value = null;
    const res = container.editProject(command);
    if (!res.ok) {
      lastError.value = res.violations.map((v) => v.message).join(' ');
      diagnosticLog.record({ category: 'edit', code: 'EDIT_REJECTED' });
      return false;
    }

    assertDevInvariants(res.project);
    project.value = res.project;
    canUndo.value = res.canUndo;
    canRedo.value = res.canRedo;
    if (res.changedSemantically) {
      scheduleValidation();
    }
    scheduleAutosave();
    diagnosticLog.record({ category: 'edit', code: command.type });
    return true;
  }

  function undo(): void {
    const res = container.undo();
    if (!res.ok) return;
    project.value = res.project;
    canUndo.value = res.canUndo;
    canRedo.value = res.canRedo;
    scheduleValidation();
    scheduleAutosave();
  }

  function redo(): void {
    const res = container.redo();
    if (!res.ok) return;
    project.value = res.project;
    canUndo.value = res.canUndo;
    canRedo.value = res.canRedo;
    scheduleValidation();
    scheduleAutosave();
  }

  function enterServiceInternal(serviceId: EntityId): void {
    if (!project.value) return;
    const hasInternal = Object.hasOwn(project.value.internals, serviceId);
    if (!hasInternal) {
      const ok = dispatchEdit({
        type: 'ensureInternalArchitecture',
        payload: { serviceId },
      });
      if (!ok) return;
    }
    activeScope.value = { level: 'internal', serviceId };
    selectedElement.value = null;
    highlightedIds.value = new Set();
  }

  function navigateToSystem(): void {
    activeScope.value = { level: 'system' };
    selectedElement.value = null;
    highlightedIds.value = new Set();
  }

  function computeNextGridPosition(): Point2D {
    const current = project.value;
    if (!current) return { x: 120, y: 120 };
    const count =
      activeScope.value.level === 'system'
        ? current.topology.nodes.length
        : (current.internals[activeScope.value.serviceId]?.units.length ?? 0);
    const col = count % 4;
    const row = Math.floor(count / 4);
    return { x: 80 + col * 280, y: 80 + row * 150 };
  }

  async function applyLayout(
    measuredDimensions?: Readonly<Record<EntityId, { readonly width: number; readonly height: number }>>,
  ): Promise<boolean> {
    if (!project.value) return false;
    const res = await container.applyViewLayout({
      scope: activeScope.value,
      ...(measuredDimensions !== undefined ? { measuredDimensions } : {}),
    });
    if (res.status !== 'applied') return false;
    project.value = res.project;
    canUndo.value = res.canUndo;
    canRedo.value = res.canRedo;
    scheduleAutosave();
    diagnosticLog.record({ category: 'layout', code: 'LAYOUT_APPLIED' });
    return true;
  }

  async function handleImportFile(
    file: File,
    conflictStrategy?: ImportConflictStrategy,
  ): Promise<void> {
    await flushAutosave();
    const res = await container.importProject(
      {
        fileName: file.name,
        byteLength: file.size,
        readText: () => file.text(),
      },
      conflictStrategy ? { conflictStrategy } : undefined,
    );

    if (res.ok) {
      importModal.value = { open: false, mode: 'error', message: '', details: [] };
      project.value = res.project;
      activeScope.value = { level: 'system' };
      selectedElement.value = null;
      highlightedIds.value = new Set();
      dirtyFlag.value = false;
      unexportedChangesFlag.value = false;
      recoveryBanner.value = null;
      syncHistoryFlags();
      runValidationNow(res.project);
      await refreshProjectSummaries();
      diagnosticLog.record({ category: 'import-export', code: 'IMPORT_OK' });
      return;
    }

    if (res.code === 'ID_CONFLICT') {
      importModal.value = {
        open: true,
        mode: 'conflict',
        message: `Já existe um projeto local com o ID "${res.existingProjectId}" (${res.existingProjectName}). Como deseja prosseguir?`,
        details: [],
        existingProjectName: res.existingProjectName,
        pendingFile: file,
      };
      return;
    }

    importModal.value = {
      open: true,
      mode: 'error',
      message: res.message,
      details: res.details,
    };
    diagnosticLog.record({ category: 'import-export', code: res.code });
  }

  async function resolveImportConflict(strategy: ImportConflictStrategy): Promise<void> {
    const file = importModal.value.pendingFile;
    if (!file) return;
    await handleImportFile(file, strategy);
  }

  function closeImportModal(): void {
    importModal.value = { open: false, mode: 'error', message: '', details: [] };
  }

  async function exportCurrentProjectJson(): Promise<{ fileName: string; content: string } | null> {
    if (!project.value) return null;
    await flushAutosave();
    const content = container.exportProject(project.value);
    unexportedChangesFlag.value = false;
    const safeName = project.value.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'project';
    diagnosticLog.record({ category: 'import-export', code: 'EXPORT_OK' });
    return { fileName: `${safeName}.flow-forge.json`, content };
  }

  function exportMemoryEmergencyJson(): { fileName: string; content: string } | null {
    if (!project.value) return null;
    const content = container.exportEmergencyJson(project.value);
    unexportedChangesFlag.value = false;
    return { fileName: `${project.value.id}-recovery.flow-forge.json`, content };
  }

  async function reloadFromIndexedDb(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    dirtyFlag.value = false;
    recoveryBanner.value = null;
    await openExistingProject(id);
  }

  function navigateToDiagnostic(diag: Diagnostic): readonly EntityId[] {
    if (diag.scope.level === 'system') {
      activeScope.value = { level: 'system' };
    } else {
      activeScope.value = { level: 'internal', serviceId: diag.scope.serviceId };
    }
    const ids = diag.targets.map((t) => t.id);
    highlightedIds.value = new Set(ids);

    const firstTarget = diag.targets[0];
    if (
      firstTarget &&
      (firstTarget.kind === 'system-node' ||
        firstTarget.kind === 'runtime-connection' ||
        firstTarget.kind === 'code-unit' ||
        firstTarget.kind === 'static-dependency')
    ) {
      selectedElement.value = { kind: firstTarget.kind, id: firstTarget.id };
    }

    return diag.targets
      .filter((t) => t.kind === 'system-node' || t.kind === 'code-unit')
      .map((t) => t.id);
  }

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (dirtyFlag.value || isSaving.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (validationTimer) clearTimeout(validationTimer);
    if (autosaveTimer) clearTimeout(autosaveTimer);
  });

  return {
    project,
    projectSummaries,
    activeScope,
    selectedElement,
    highlightedIds,
    diagnostics,
    errorCount,
    warningCount,
    canUndo,
    canRedo,
    dirtyFlag,
    unexportedChangesFlag,
    isSaving,
    lastError,
    recoveryBanner,
    importModal,
    diagnosticLog,
    init,
    createNewProject,
    openExistingProject,
    openExample,
    deleteActiveProject,
    dispatchEdit,
    undo,
    redo,
    enterServiceInternal,
    navigateToSystem,
    computeNextGridPosition,
    applyLayout,
    flushAutosave,
    handleImportFile,
    resolveImportConflict,
    closeImportModal,
    exportCurrentProjectJson,
    exportMemoryEmergencyJson,
    reloadFromIndexedDb,
    navigateToDiagnostic,
  };
}
