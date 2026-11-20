import { validateStructuralInvariants } from '@domain/invariants';
import type { ArchitectureProject, EntityId } from '@domain/types';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_IMPORT_FILE_BYTES,
  parseProjectFileDtoV1,
  serializeProjectFileDeterministically,
} from '@schemas/projectFileV1';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { WorkspaceSession } from './sessionState';

export interface ImportFileSource {
  readonly fileName: string;
  readonly byteLength: number;
  readText(): Promise<string>;
}

export type ImportConflictStrategy = 'copy' | 'replace';

export type ImportErrorCode =
  | 'INVALID_FILE_EXTENSION'
  | 'FILE_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_SCHEMA_VERSION'
  | 'UNSUPPORTED_FUTURE_VERSION'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'STRUCTURAL_INVARIANT_VIOLATION';

export type ImportProjectResult =
  | {
      readonly ok: true;
      readonly project: ArchitectureProject;
      readonly persistedRevision: number;
      readonly resolution: 'created' | 'copied' | 'replaced';
    }
  | {
      readonly ok: false;
      readonly code: 'ID_CONFLICT';
      readonly existingProjectId: EntityId;
      readonly existingProjectName: string;
      readonly importedProject: ArchitectureProject;
    }
  | {
      readonly ok: false;
      readonly code: ImportErrorCode;
      readonly message: string;
      readonly details: readonly string[];
    };

export interface ImportProjectDeps {
  readonly projectRepo: ProjectRepository;
  readonly session: WorkspaceSession;
  readonly clock?: () => string;
  readonly idGenerator?: () => EntityId;
}

export interface ImportProjectOptions {
  readonly conflictStrategy?: ImportConflictStrategy;
  readonly activateInSession?: boolean;
}

function validateRawProjectPayload(
  raw: unknown,
):
  | { readonly ok: true; readonly project: ArchitectureProject }
  | {
      readonly ok: false;
      readonly code: ImportErrorCode;
      readonly message: string;
      readonly details: readonly string[];
    } {
  // Stage 2 & 3: Schema version gate + strict Zod v4 validation
  const schemaResult = parseProjectFileDtoV1(raw);
  if (!schemaResult.ok) {
    return {
      ok: false,
      code: schemaResult.code,
      message: schemaResult.message,
      details: schemaResult.details,
    };
  }

  // Stage 4: Structural referential integrity invariants
  const violations = validateStructuralInvariants(schemaResult.value.project);
  if (violations.length > 0) {
    return {
      ok: false,
      code: 'STRUCTURAL_INVARIANT_VIOLATION',
      message: 'O projeto falhou na verificação de integridade referencial estrutural.',
      details: violations.map((v) => `[${v.code}] ${v.message}`),
    };
  }

  return { ok: true, project: schemaResult.value.project };
}

export async function persistValidatedImport(
  deps: ImportProjectDeps,
  project: ArchitectureProject,
  options: ImportProjectOptions = {},
): Promise<ImportProjectResult> {
  const nowIso = (deps.clock ?? (() => new Date().toISOString()))();
  const nextId = deps.idGenerator ?? (() => crypto.randomUUID());
  const activate = options.activateInSession ?? true;

  const existing = await deps.projectRepo.load(project.id);

  let finalProject = project;
  let expectedRevision: number | null = null;
  let resolution: 'created' | 'copied' | 'replaced' = 'created';

  if (existing !== null) {
    if (!options.conflictStrategy) {
      return {
        ok: false,
        code: 'ID_CONFLICT',
        existingProjectId: existing.id,
        existingProjectName: existing.project.name,
        importedProject: project,
      };
    }

    if (options.conflictStrategy === 'copy') {
      const copyName = `${project.name} (Cópia)`.slice(0, 120);
      finalProject = {
        ...project,
        id: nextId(),
        name: copyName,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expectedRevision = null;
      resolution = 'copied';
    } else {
      expectedRevision = existing.persistedRevision;
      finalProject = {
        ...project,
        updatedAt: nowIso,
      };
      resolution = 'replaced';
    }
  }

  const persistedRevision = await deps.projectRepo.save(finalProject, expectedRevision);

  if (activate) {
    deps.session.currentProject = finalProject;
    deps.session.lastPersistedRevision = persistedRevision;
    deps.session.mutationSeq += 1;
    deps.session.history.reset();
  }

  return {
    ok: true,
    project: finalProject,
    persistedRevision,
    resolution,
  };
}

export async function importProject(
  deps: ImportProjectDeps,
  source: ImportFileSource,
  options: ImportProjectOptions = {},
): Promise<ImportProjectResult> {
  // Stage 1: Pre-read extension and size checks
  if (!source.fileName.toLowerCase().endsWith('.json')) {
    return {
      ok: false,
      code: 'INVALID_FILE_EXTENSION',
      message: 'Apenas arquivos com extensão ".json" podem ser importados.',
      details: [`Arquivo recebido: ${source.fileName}`],
    };
  }

  if (source.byteLength > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `O arquivo excede o limite máximo de 5 MB (${MAX_IMPORT_FILE_BYTES} bytes).`,
      details: [`Tamanho recebido: ${source.byteLength} bytes`],
    };
  }

  // Stage 2: Protected JSON.parse
  let raw: unknown;
  try {
    const text = await source.readText();
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      code: 'INVALID_JSON',
      message: 'Não foi possível interpretar o arquivo como JSON válido.',
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  const validated = validateRawProjectPayload(raw);
  if (!validated.ok) {
    return validated;
  }

  return persistValidatedImport(deps, validated.project, options);
}

export async function importRawProjectPayload(
  deps: ImportProjectDeps,
  rawPayload: unknown,
  options: ImportProjectOptions = {},
): Promise<ImportProjectResult> {
  const validated = validateRawProjectPayload(rawPayload);
  if (!validated.ok) {
    return validated;
  }
  return persistValidatedImport(deps, validated.project, options);
}

export function exportProject(
  project: ArchitectureProject,
  clock: () => string = () => new Date().toISOString(),
): string {
  return serializeProjectFileDeterministically({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: clock(),
    project,
  });
}

export function exportEmergencyJson(
  project: ArchitectureProject,
  clock: () => string = () => new Date().toISOString(),
): string {
  return exportProject(project, clock);
}
