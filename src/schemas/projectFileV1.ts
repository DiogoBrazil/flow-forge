import { z } from 'zod';
import type { ArchitectureProject, ArchitectureView, EntityId, InternalArchitecture, Point2D } from '@domain/types';

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const MAX_IMPORT_FILE_BYTES = 5_242_880; // 5 MiB

const RESERVED_ENTITY_IDS = new Set(['__proto__', 'constructor', 'prototype', 'toString']);

export const EntityIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/, 'ID deve conter apenas letras, números, "_" ou "-" (1 a 64 caracteres).')
  .refine((val) => !RESERVED_ENTITY_IDS.has(val), {
    message: 'ID utiliza palavra reservada proibida.',
  });

const NonEmptyNameSchema = z
  .string()
  .refine((val) => val.trim().length >= 1 && val.trim().length <= 120, {
    message: 'Nome deve ter entre 1 e 120 caracteres (desconsiderando espaços nas extremidades).',
  });

const DescriptionSchema = z.string().max(4000);
const LabelSchema = z.string().max(120);
const TechnologySchema = z.string().max(80);
const IsoTimestampSchema = z.string().min(1).max(64);

const Point2DSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});

const RuleProfileIdSchema = z.enum(['hexagonal', 'layered', 'distributed-baseline']);

const SystemNodeKindSchema = z.enum([
  'client',
  'gateway',
  'service',
  'database',
  'cache',
  'broker',
  'external-system',
]);

const RuntimeConnectionKindSchema = z.enum([
  'sync-call',
  'async-publish',
  'async-consume',
  'data-access',
  'cache-access',
]);

const RuntimeProtocolSchema = z.enum(['http', 'grpc', 'sql', 'redis', 'amqp', 'kafka', 'custom']);

const CodeUnitKindSchema = z.enum([
  'inbound-adapter',
  'outbound-adapter',
  'use-case',
  'domain-service',
  'domain-entity',
  'interface',
]);

const CodeLayerSchema = z.enum(['adapters', 'application', 'domain']);

const StaticDependencyKindSchema = z.enum(['depends-on', 'implements']);

const SystemNodeSchema = z.strictObject({
  id: EntityIdSchema,
  name: NonEmptyNameSchema,
  kind: SystemNodeKindSchema,
  description: DescriptionSchema,
  technology: TechnologySchema.exactOptional(),
});

const RuntimeConnectionSchema = z.strictObject({
  id: EntityIdSchema,
  sourceId: EntityIdSchema,
  targetId: EntityIdSchema,
  kind: RuntimeConnectionKindSchema,
  protocol: RuntimeProtocolSchema,
  label: LabelSchema.exactOptional(),
});

const DistributedTopologySchema = z.strictObject({
  nodes: z.array(SystemNodeSchema),
  connections: z.array(RuntimeConnectionSchema),
});

const CodeUnitSchema = z.strictObject({
  id: EntityIdSchema,
  name: NonEmptyNameSchema,
  kind: CodeUnitKindSchema,
  layer: CodeLayerSchema,
  description: DescriptionSchema,
});

const StaticDependencySchema = z.strictObject({
  id: EntityIdSchema,
  sourceId: EntityIdSchema,
  targetId: EntityIdSchema,
  kind: StaticDependencyKindSchema,
  label: LabelSchema.exactOptional(),
});

const InternalArchitectureSchema = z.strictObject({
  serviceId: EntityIdSchema,
  units: z.array(CodeUnitSchema),
  dependencies: z.array(StaticDependencySchema),
});

const BoundaryBindingSchema = z.strictObject({
  id: EntityIdSchema,
  serviceId: EntityIdSchema,
  runtimeConnectionId: EntityIdSchema,
  adapterUnitId: EntityIdSchema,
});

const ViewScopeSchema = z.discriminatedUnion('level', [
  z.strictObject({
    level: z.literal('system'),
  }),
  z.strictObject({
    level: z.literal('internal'),
    serviceId: EntityIdSchema,
  }),
]);

const ArchitectureViewSchema = z.strictObject({
  id: EntityIdSchema,
  scope: ViewScopeSchema,
  nodePositions: z.record(EntityIdSchema, Point2DSchema),
});

export const ArchitectureProjectSchema = z.strictObject({
  id: EntityIdSchema,
  name: NonEmptyNameSchema,
  description: DescriptionSchema,
  ruleProfile: RuleProfileIdSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  topology: DistributedTopologySchema,
  internals: z.record(EntityIdSchema, InternalArchitectureSchema),
  bindings: z.array(BoundaryBindingSchema),
  views: z.array(ArchitectureViewSchema),
});

export const ProjectFileDtoV1Schema = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  exportedAt: IsoTimestampSchema.exactOptional(),
  project: ArchitectureProjectSchema,
});

export interface ProjectFileDtoV1 {
  readonly schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  readonly exportedAt?: string;
  readonly project: ArchitectureProject;
}

export type SchemaParseErrorCode =
  | 'INVALID_SCHEMA_VERSION'
  | 'UNSUPPORTED_FUTURE_VERSION'
  | 'SCHEMA_VALIDATION_FAILED';

export interface SchemaParseFailure {
  readonly ok: false;
  readonly code: SchemaParseErrorCode;
  readonly message: string;
  readonly details: readonly string[];
}

export type SchemaParseResult =
  | { readonly ok: true; readonly value: ProjectFileDtoV1 }
  | SchemaParseFailure;

function hasForbiddenKeysDeep(value: unknown, path = ''): string | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = hasForbiddenKeysDeep(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (RESERVED_ENTITY_IDS.has(key)) {
      return path ? `${path}.${key}` : key;
    }
    const found = hasForbiddenKeysDeep(
      (value as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
    );
    if (found) return found;
  }
  return null;
}

export function formatZodError(error: z.ZodError): readonly string[] {
  const flat = z.flattenError(error);
  const messages: string[] = [...flat.formErrors];
  for (const [field, fieldErrors] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(fieldErrors)) {
      for (const msg of fieldErrors) {
        messages.push(`${field}: ${msg}`);
      }
    }
  }
  if (messages.length === 0) {
    return error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  return messages;
}

export function parseProjectFileDtoV1(raw: unknown): SchemaParseResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      code: 'INVALID_SCHEMA_VERSION',
      message: 'Arquivo JSON deve conter um objeto raiz com o campo "schemaVersion".',
      details: ['Raiz do JSON não é um objeto.'],
    };
  }

  const forbiddenPath = hasForbiddenKeysDeep(raw);
  if (forbiddenPath !== null) {
    return {
      ok: false,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: `Chave reservada proibida detectada no JSON em "${forbiddenPath}".`,
      details: [`Chave proibida: ${forbiddenPath}`],
    };
  }

  const version = (raw as Record<string, unknown>)['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      code: 'INVALID_SCHEMA_VERSION',
      message: 'Campo "schemaVersion" ausente ou inválido (esperado inteiro positivo igual a 1).',
      details: [`schemaVersion recebido: ${String(version)}`],
    };
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'UNSUPPORTED_FUTURE_VERSION',
      message: `Versão de schema ${version} não suportada por esta versão do Flow-Forge (suportado: schemaVersion ${CURRENT_SCHEMA_VERSION}).`,
      details: [`schemaVersion=${version} > ${CURRENT_SCHEMA_VERSION}`],
    };
  }

  const parsed = ProjectFileDtoV1Schema.safeParse(raw);
  if (!parsed.success) {
    const details = formatZodError(parsed.error);
    return {
      ok: false,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'O arquivo JSON não está em conformidade com o schema v1 do Flow-Forge.',
      details,
    };
  }

  return {
    ok: true,
    value: parsed.data,
  };
}

function compareLex(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortById<T extends { readonly id: EntityId }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareLex(a.id, b.id));
}

function sortRecordKeys<T>(record: Record<EntityId, T>): Record<EntityId, T> {
  const sorted: Record<EntityId, T> = {};
  const keys = Object.keys(record)
    .filter((k) => Object.hasOwn(record, k))
    .sort(compareLex);
  for (const key of keys) {
    const val = record[key];
    if (val !== undefined) {
      sorted[key] = val;
    }
  }
  return sorted;
}

function normalizeProjectForSerialization(project: ArchitectureProject): ArchitectureProject {
  const sortedInternals: Record<EntityId, InternalArchitecture> = {};
  const serviceIds = Object.keys(project.internals)
    .filter((k) => Object.hasOwn(project.internals, k))
    .sort(compareLex);
  for (const serviceId of serviceIds) {
    const internal = project.internals[serviceId];
    if (!internal) continue;
    sortedInternals[serviceId] = {
      serviceId: internal.serviceId,
      units: sortById(internal.units),
      dependencies: sortById(internal.dependencies),
    };
  }

  const sortedViews: ArchitectureView[] = sortById(project.views).map((view) => ({
    id: view.id,
    scope: view.scope,
    nodePositions: sortRecordKeys<Point2D>(view.nodePositions),
  }));

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ruleProfile: project.ruleProfile,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    topology: {
      nodes: sortById(project.topology.nodes),
      connections: sortById(project.topology.connections),
    },
    internals: sortedInternals,
    bindings: sortById(project.bindings),
    views: sortedViews,
  };
}

export function serializeProjectFileDeterministically(dto: ProjectFileDtoV1): string {
  const normalized: ProjectFileDtoV1 = {
    schemaVersion: dto.schemaVersion,
    ...(dto.exportedAt !== undefined ? { exportedAt: dto.exportedAt } : {}),
    project: normalizeProjectForSerialization(dto.project),
  };
  return JSON.stringify(normalized, null, 2);
}
