import { createEmptyProject } from '@domain/commands';
import { validateStructuralInvariants } from '@domain/invariants';
import type { ArchitectureProject, EntityId, RuleProfileId } from '@domain/types';
import { BUILTIN_EXAMPLES } from '@examples/index';
import { CURRENT_SCHEMA_VERSION, parseProjectFileDtoV1 } from '@schemas/projectFileV1';
import type { ProjectRepository, ProjectSummary } from '../ports/ProjectRepository';
import { importRawProjectPayload } from './importExportProject';
import type { ImportProjectResult } from './importExportProject';
import type { WorkspaceSession } from './sessionState';

export interface ProjectLifecycleDeps {
  readonly projectRepo: ProjectRepository;
  readonly session: WorkspaceSession;
  readonly clock?: () => string;
  readonly idGenerator?: () => EntityId;
}

export interface CreateProjectInput {
  readonly id?: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly ruleProfile?: RuleProfileId;
}

export async function createProject(
  deps: ProjectLifecycleDeps,
  input: CreateProjectInput,
): Promise<{ readonly project: ArchitectureProject; readonly persistedRevision: number }> {
  const nowIso = (deps.clock ?? (() => new Date().toISOString()))();
  const nextId = deps.idGenerator ?? (() => crypto.randomUUID());

  const created = createEmptyProject(
    {
      name: input.name,
      ...(input.id !== undefined ? { id: input.id } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ruleProfile: input.ruleProfile ?? 'hexagonal',
    },
    nowIso,
    nextId,
  );

  if (!created.ok) {
    throw new Error(
      `Falha ao criar projeto: ${created.violations.map((v) => v.message).join('; ')}`,
    );
  }

  const persistedRevision = await deps.projectRepo.save(created.value, null);
  deps.session.currentProject = created.value;
  deps.session.lastPersistedRevision = persistedRevision;
  deps.session.mutationSeq += 1;
  deps.session.history.reset();

  return { project: created.value, persistedRevision };
}

export type OpenProjectResult =
  | {
      readonly ok: true;
      readonly project: ArchitectureProject;
      readonly persistedRevision: number;
    }
  | {
      readonly ok: false;
      readonly code: 'NOT_FOUND' | 'CORRUPTED_PROJECT';
      readonly message: string;
    };

export async function openProject(
  deps: ProjectLifecycleDeps,
  projectId: EntityId,
): Promise<OpenProjectResult> {
  const record = await deps.projectRepo.load(projectId);
  if (!record) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: `Projeto "${projectId}" não encontrado no armazenamento local.`,
    };
  }

  const parsed = parseProjectFileDtoV1({
    schemaVersion: record.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    project: record.project,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      code: 'CORRUPTED_PROJECT',
      message: parsed.message,
    };
  }

  const violations = validateStructuralInvariants(parsed.value.project);
  if (violations.length > 0) {
    return {
      ok: false,
      code: 'CORRUPTED_PROJECT',
      message: `Projeto armazenado viola invariantes estruturais: ${violations.map((v) => v.code).join(', ')}.`,
    };
  }

  deps.session.currentProject = parsed.value.project;
  deps.session.lastPersistedRevision = record.persistedRevision;
  deps.session.mutationSeq += 1;
  deps.session.history.reset();

  return {
    ok: true,
    project: parsed.value.project,
    persistedRevision: record.persistedRevision,
  };
}

export async function saveProject(
  deps: ProjectLifecycleDeps,
): Promise<{ readonly persistedRevision: number }> {
  const current = deps.session.currentProject;
  if (!current) {
    throw new Error('Nenhum projeto ativo na sessão para salvar.');
  }

  const nextRevision = await deps.projectRepo.save(current, deps.session.lastPersistedRevision);
  deps.session.lastPersistedRevision = nextRevision;
  return { persistedRevision: nextRevision };
}

export async function deleteProject(
  deps: ProjectLifecycleDeps,
  projectId: EntityId,
): Promise<void> {
  await deps.projectRepo.delete(projectId);
  if (deps.session.currentProject?.id === projectId) {
    deps.session.currentProject = null;
    deps.session.lastPersistedRevision = null;
    deps.session.mutationSeq += 1;
    deps.session.history.reset();
  }
}

export async function listProjects(
  deps: Pick<ProjectLifecycleDeps, 'projectRepo'>,
): Promise<readonly ProjectSummary[]> {
  return deps.projectRepo.listSummaries();
}

export async function createProjectFromExample(
  deps: ProjectLifecycleDeps,
  exampleId: string,
): Promise<ImportProjectResult> {
  const example = BUILTIN_EXAMPLES.find((ex) => ex.id === exampleId);
  if (!example) {
    return {
      ok: false,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: `Exemplo "${exampleId}" não encontrado no catálogo embutido.`,
      details: [`exampleId=${exampleId}`],
    };
  }

  return importRawProjectPayload(deps, example.rawPayload, {
    conflictStrategy: 'copy',
    activateInSession: true,
  });
}
