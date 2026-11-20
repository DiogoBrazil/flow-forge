import type { AppContainer, AppContainerDeps } from '@application/AppContainer';
import { applyViewLayout } from '@application/use-cases/applyViewLayout';
import {
  editProject,
  getHistoryState,
  redoProjectEdit,
  undoProjectEdit,
} from '@application/use-cases/editArchitecture';
import {
  exportEmergencyJson,
  exportProject,
  importProject,
} from '@application/use-cases/importExportProject';
import {
  createProject,
  createProjectFromExample,
  deleteProject,
  listProjects,
  openProject,
  saveProject,
} from '@application/use-cases/projectLifecycle';
import { createWorkspaceSession } from '@application/use-cases/sessionState';
import type { ViewScope } from '@domain/types';
import { DagreLayoutAdapter } from '@layout/DagreLayoutAdapter';
import { IndexedDBProjectRepository } from '@storage/IndexedDBProjectRepository';

export function createAppContainer(overrides: Partial<AppContainerDeps> = {}): AppContainer {
  const clock = overrides.clock ?? (() => new Date().toISOString());
  const idGenerator = overrides.idGenerator ?? (() => crypto.randomUUID());
  const projectRepo = overrides.projectRepo ?? new IndexedDBProjectRepository(undefined, clock);
  const layoutPort = overrides.layoutPort ?? new DagreLayoutAdapter();
  const session = createWorkspaceSession();

  let activeScopeGetter: () => ViewScope = overrides.getActiveScope ?? (() => ({ level: 'system' }));

  const lifecycleDeps = { projectRepo, session, clock, idGenerator };
  const editDeps = { session, clock, idGenerator };

  return {
    projectRepo,
    layoutPort,
    session,
    setActiveScopeGetter(getter) {
      activeScopeGetter = getter;
    },
    createProject(input) {
      return createProject(lifecycleDeps, input);
    },
    openProject(projectId) {
      return openProject(lifecycleDeps, projectId);
    },
    saveProject() {
      return saveProject(lifecycleDeps);
    },
    deleteProject(projectId) {
      return deleteProject(lifecycleDeps, projectId);
    },
    listProjects() {
      return listProjects({ projectRepo });
    },
    createProjectFromExample(exampleId) {
      return createProjectFromExample(lifecycleDeps, exampleId);
    },
    editProject(command) {
      return editProject(editDeps, command);
    },
    undo() {
      return undoProjectEdit({ session });
    },
    redo() {
      return redoProjectEdit({ session });
    },
    getHistoryState() {
      return getHistoryState({ session });
    },
    importProject(source, options) {
      return importProject(lifecycleDeps, source, options);
    },
    exportProject(project) {
      return exportProject(project, clock);
    },
    exportEmergencyJson(project) {
      return exportEmergencyJson(project, clock);
    },
    applyViewLayout(input) {
      return applyViewLayout(
        {
          layoutPort,
          session,
          getActiveScope: () => activeScopeGetter(),
          clock,
        },
        input,
      );
    },
  };
}
