import type { ArchitectureProject, EntityId, ViewScope } from '@domain/types';
import type { LayoutPort } from './ports/LayoutPort';
import type { ProjectRepository, ProjectSummary } from './ports/ProjectRepository';
import type { ApplyViewLayoutInput, ApplyViewLayoutResult } from './use-cases/applyViewLayout';
import type {
  ArchitectureCommand,
  EditArchitectureResult,
  EditArchitectureSuccess,
} from './use-cases/editArchitecture';
import type {
  ImportFileSource,
  ImportProjectOptions,
  ImportProjectResult,
} from './use-cases/importExportProject';
import type { CreateProjectInput, OpenProjectResult } from './use-cases/projectLifecycle';
import type { HistoryStateSnapshot, WorkspaceSession } from './use-cases/sessionState';

export interface AppContainerDeps {
  readonly projectRepo: ProjectRepository;
  readonly layoutPort: LayoutPort;
  readonly clock: () => string;
  readonly idGenerator: () => EntityId;
  readonly getActiveScope: () => ViewScope;
}

export interface AppContainer {
  readonly projectRepo: ProjectRepository;
  readonly layoutPort: LayoutPort;
  readonly session: WorkspaceSession;
  setActiveScopeGetter(getter: () => ViewScope): void;
  createProject(
    input: CreateProjectInput,
  ): Promise<{ readonly project: ArchitectureProject; readonly persistedRevision: number }>;
  openProject(projectId: EntityId): Promise<OpenProjectResult>;
  saveProject(): Promise<{ readonly persistedRevision: number }>;
  deleteProject(projectId: EntityId): Promise<void>;
  listProjects(): Promise<readonly ProjectSummary[]>;
  createProjectFromExample(exampleId: string): Promise<ImportProjectResult>;
  editProject(command: ArchitectureCommand): EditArchitectureResult;
  undo(): EditArchitectureSuccess | { readonly ok: false };
  redo(): EditArchitectureSuccess | { readonly ok: false };
  getHistoryState(): HistoryStateSnapshot;
  importProject(
    source: ImportFileSource,
    options?: ImportProjectOptions,
  ): Promise<ImportProjectResult>;
  exportProject(project: ArchitectureProject): string;
  exportEmergencyJson(project: ArchitectureProject): string;
  applyViewLayout(input: ApplyViewLayoutInput): Promise<ApplyViewLayoutResult>;
}
