import { validateStructuralInvariants } from './invariants';
import { DEFAULT_LAYER_BY_UNIT_KIND } from './limits';
import type {
  ArchitectureProject,
  ArchitectureView,
  BoundaryBinding,
  CodeLayer,
  CodeUnit,
  CodeUnitKind,
  DomainResult,
  EntityId,
  InternalArchitecture,
  Point2D,
  RuleProfileId,
  RuntimeConnection,
  RuntimeConnectionKind,
  RuntimeProtocol,
  StaticDependency,
  StaticDependencyKind,
  StructuralViolation,
  SystemNode,
  SystemNodeKind,
  ViewScope,
} from './types';

const defaultIdGenerator = (): EntityId => crypto.randomUUID();

function finalize(candidate: ArchitectureProject): DomainResult<ArchitectureProject> {
  const violations = validateStructuralInvariants(candidate);
  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true, value: candidate };
}

function fail(violation: StructuralViolation): DomainResult<ArchitectureProject> {
  return { ok: false, violations: [violation] };
}

function isSameScope(a: ViewScope, b: ViewScope): boolean {
  if (a.level !== b.level) return false;
  if (a.level === 'system') return true;
  return a.serviceId === (b as { readonly level: 'internal'; readonly serviceId: EntityId }).serviceId;
}

function omitKey<T>(record: Record<EntityId, T>, keyToRemove: EntityId): Record<EntityId, T> {
  const next: Record<EntityId, T> = {};
  for (const key of Object.keys(record)) {
    if (!Object.hasOwn(record, key) || key === keyToRemove) continue;
    const val = record[key];
    if (val !== undefined) {
      next[key] = val;
    }
  }
  return next;
}

export interface CreateEmptyProjectPayload {
  readonly id?: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly ruleProfile?: RuleProfileId;
  readonly systemViewId?: EntityId;
}

export function createEmptyProject(
  payload: CreateEmptyProjectPayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const project: ArchitectureProject = {
    id: payload.id ?? nextId(),
    name: payload.name,
    description: payload.description ?? '',
    ruleProfile: payload.ruleProfile ?? 'hexagonal',
    createdAt: nowIso,
    updatedAt: nowIso,
    topology: {
      nodes: [],
      connections: [],
    },
    internals: {},
    bindings: [],
    views: [
      {
        id: payload.systemViewId ?? nextId(),
        scope: { level: 'system' },
        nodePositions: {},
      },
    ],
  };
  return finalize(project);
}

export interface AddSystemNodePayload {
  readonly id?: EntityId;
  readonly name: string;
  readonly kind: SystemNodeKind;
  readonly description?: string;
  readonly technology?: string;
  readonly position: Point2D;
}

export function addSystemNode(
  project: ArchitectureProject,
  payload: AddSystemNodePayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const nodeId = payload.id ?? nextId();
  const node: SystemNode = {
    id: nodeId,
    name: payload.name,
    kind: payload.kind,
    description: payload.description ?? '',
    ...(payload.technology !== undefined ? { technology: payload.technology } : {}),
  };

  const views = project.views.map((view) =>
    view.scope.level === 'system'
      ? {
          ...view,
          nodePositions: {
            ...view.nodePositions,
            [nodeId]: { x: payload.position.x, y: payload.position.y },
          },
        }
      : view,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: {
      ...project.topology,
      nodes: [...project.topology.nodes, node],
    },
    views,
  });
}

export interface UpdateSystemNodePayload {
  readonly id: EntityId;
  readonly name?: string;
  readonly description?: string;
  readonly technology?: string | null;
}

export function updateSystemNode(
  project: ArchitectureProject,
  payload: UpdateSystemNodePayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const exists = project.topology.nodes.some((n) => n.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `SystemNode "${payload.id}" não encontrado.`,
    });
  }

  const nodes = project.topology.nodes.map((node) => {
    if (node.id !== payload.id) return node;
    const nextTech =
      payload.technology === null
        ? undefined
        : payload.technology !== undefined
          ? payload.technology
          : node.technology;
    return {
      id: node.id,
      name: payload.name ?? node.name,
      kind: node.kind,
      description: payload.description ?? node.description,
      ...(nextTech !== undefined ? { technology: nextTech } : {}),
    };
  });

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: {
      ...project.topology,
      nodes,
    },
  });
}

export interface ChangeSystemNodeKindPayload {
  readonly id: EntityId;
  readonly kind: SystemNodeKind;
}

export function changeSystemNodeKind(
  project: ArchitectureProject,
  payload: ChangeSystemNodeKindPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const existing = project.topology.nodes.find((n) => n.id === payload.id);
  if (!existing) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `SystemNode "${payload.id}" não encontrado.`,
    });
  }

  if (existing.kind === payload.kind) {
    return finalize({ ...project, updatedAt: nowIso });
  }

  if (existing.kind === 'service' && payload.kind !== 'service') {
    const internal = Object.hasOwn(project.internals, payload.id)
      ? project.internals[payload.id]
      : undefined;
    if (internal && internal.units.length > 0) {
      return fail({
        code: 'NON_EMPTY_INTERNAL_ARCHITECTURE',
        entityId: payload.id,
        message: `Não é possível alterar o tipo do serviço "${payload.id}" enquanto houver unidades na arquitetura interna.`,
      });
    }

    // Empty internal architecture can be cleaned up cleanly
    const internals = omitKey(project.internals, payload.id);
    const views = project.views.filter(
      (v) => !(v.scope.level === 'internal' && v.scope.serviceId === payload.id),
    );
    const bindings = project.bindings.filter((b) => b.serviceId !== payload.id);
    const nodes = project.topology.nodes.map((n) =>
      n.id === payload.id ? { ...n, kind: payload.kind } : n,
    );

    return finalize({
      ...project,
      updatedAt: nowIso,
      topology: { ...project.topology, nodes },
      internals,
      bindings,
      views,
    });
  }

  const nodes = project.topology.nodes.map((n) =>
    n.id === payload.id ? { ...n, kind: payload.kind } : n,
  );
  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { ...project.topology, nodes },
  });
}

export function clearInternalArchitectureAndChangeKind(
  project: ArchitectureProject,
  payload: ChangeSystemNodeKindPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const existing = project.topology.nodes.find((n) => n.id === payload.id);
  if (!existing) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `SystemNode "${payload.id}" não encontrado.`,
    });
  }

  const internals = omitKey(project.internals, payload.id);
  const views = project.views.filter(
    (v) => !(v.scope.level === 'internal' && v.scope.serviceId === payload.id),
  );
  const bindings = project.bindings.filter((b) => b.serviceId !== payload.id);
  const nodes = project.topology.nodes.map((n) =>
    n.id === payload.id ? { ...n, kind: payload.kind } : n,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { ...project.topology, nodes },
    internals,
    bindings,
    views,
  });
}

export interface DeleteSystemNodePayload {
  readonly id: EntityId;
}

export function deleteSystemNode(
  project: ArchitectureProject,
  payload: DeleteSystemNodePayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const exists = project.topology.nodes.some((n) => n.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `SystemNode "${payload.id}" não encontrado.`,
    });
  }

  const removedConnectionIds = new Set(
    project.topology.connections
      .filter((c) => c.sourceId === payload.id || c.targetId === payload.id)
      .map((c) => c.id),
  );

  const nodes = project.topology.nodes.filter((n) => n.id !== payload.id);
  const connections = project.topology.connections.filter((c) => !removedConnectionIds.has(c.id));
  const internals = omitKey(project.internals, payload.id);
  const bindings = project.bindings.filter(
    (b) => b.serviceId !== payload.id && !removedConnectionIds.has(b.runtimeConnectionId),
  );
  const views = project.views
    .filter((v) => !(v.scope.level === 'internal' && v.scope.serviceId === payload.id))
    .map((v) =>
      v.scope.level === 'system'
        ? { ...v, nodePositions: omitKey(v.nodePositions, payload.id) }
        : v,
    );

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { nodes, connections },
    internals,
    bindings,
    views,
  });
}

export interface AddRuntimeConnectionPayload {
  readonly id?: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: RuntimeConnectionKind;
  readonly protocol: RuntimeProtocol;
  readonly label?: string;
}

export function addRuntimeConnection(
  project: ArchitectureProject,
  payload: AddRuntimeConnectionPayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const conn: RuntimeConnection = {
    id: payload.id ?? nextId(),
    sourceId: payload.sourceId,
    targetId: payload.targetId,
    kind: payload.kind,
    protocol: payload.protocol,
    ...(payload.label !== undefined ? { label: payload.label } : {}),
  };

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: {
      ...project.topology,
      connections: [...project.topology.connections, conn],
    },
  });
}

export interface UpdateRuntimeConnectionPayload {
  readonly id: EntityId;
  readonly kind?: RuntimeConnectionKind;
  readonly protocol?: RuntimeProtocol;
  readonly label?: string | null;
}

export function updateRuntimeConnection(
  project: ArchitectureProject,
  payload: UpdateRuntimeConnectionPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const exists = project.topology.connections.some((c) => c.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `RuntimeConnection "${payload.id}" não encontrada.`,
    });
  }

  const connections = project.topology.connections.map((conn) => {
    if (conn.id !== payload.id) return conn;
    const nextLabel =
      payload.label === null
        ? undefined
        : payload.label !== undefined
          ? payload.label
          : conn.label;
    return {
      id: conn.id,
      sourceId: conn.sourceId,
      targetId: conn.targetId,
      kind: payload.kind ?? conn.kind,
      protocol: payload.protocol ?? conn.protocol,
      ...(nextLabel !== undefined ? { label: nextLabel } : {}),
    };
  });

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { ...project.topology, connections },
  });
}

export interface ReconnectRuntimeConnectionPayload {
  readonly id: EntityId;
  readonly sourceId?: EntityId;
  readonly targetId?: EntityId;
}

export function reconnectRuntimeConnection(
  project: ArchitectureProject,
  payload: ReconnectRuntimeConnectionPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const existing = project.topology.connections.find((c) => c.id === payload.id);
  if (!existing) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `RuntimeConnection "${payload.id}" não encontrada.`,
    });
  }

  const nextSourceId = payload.sourceId ?? existing.sourceId;
  const nextTargetId = payload.targetId ?? existing.targetId;

  const connections = project.topology.connections.map((conn) =>
    conn.id === payload.id ? { ...conn, sourceId: nextSourceId, targetId: nextTargetId } : conn,
  );

  // Preserve bindings where serviceId is still one of the endpoints; cascade-delete others
  const bindings = project.bindings.filter((b) => {
    if (b.runtimeConnectionId !== payload.id) return true;
    return b.serviceId === nextSourceId || b.serviceId === nextTargetId;
  });

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { ...project.topology, connections },
    bindings,
  });
}

export interface DeleteRuntimeConnectionPayload {
  readonly id: EntityId;
}

export function deleteRuntimeConnection(
  project: ArchitectureProject,
  payload: DeleteRuntimeConnectionPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const exists = project.topology.connections.some((c) => c.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `RuntimeConnection "${payload.id}" não encontrada.`,
    });
  }

  const connections = project.topology.connections.filter((c) => c.id !== payload.id);
  const bindings = project.bindings.filter((b) => b.runtimeConnectionId !== payload.id);

  return finalize({
    ...project,
    updatedAt: nowIso,
    topology: { ...project.topology, connections },
    bindings,
  });
}

export interface EnsureInternalArchitecturePayload {
  readonly serviceId: EntityId;
  readonly viewId?: EntityId;
}

export function ensureInternalArchitecture(
  project: ArchitectureProject,
  payload: EnsureInternalArchitecturePayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const serviceNode = project.topology.nodes.find((n) => n.id === payload.serviceId);
  if (!serviceNode) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `SystemNode "${payload.serviceId}" não encontrado.`,
    });
  }
  if (serviceNode.kind !== 'service') {
    return fail({
      code: 'INVALID_DRILLDOWN_TARGET',
      entityId: payload.serviceId,
      message: `Apenas nós do tipo "service" suportam arquitetura interna (recebido: "${serviceNode.kind}").`,
    });
  }

  if (Object.hasOwn(project.internals, payload.serviceId)) {
    return finalize(project);
  }

  const internal: InternalArchitecture = {
    serviceId: payload.serviceId,
    units: [],
    dependencies: [],
  };
  const view: ArchitectureView = {
    id: payload.viewId ?? nextId(),
    scope: { level: 'internal', serviceId: payload.serviceId },
    nodePositions: {},
  };

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: internal,
    },
    views: [...project.views, view],
  });
}

export interface AddCodeUnitPayload {
  readonly serviceId: EntityId;
  readonly id?: EntityId;
  readonly name: string;
  readonly kind: CodeUnitKind;
  readonly layer?: CodeLayer;
  readonly description?: string;
  readonly position: Point2D;
}

export function addCodeUnit(
  project: ArchitectureProject,
  payload: AddCodeUnitPayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não inicializada.`,
    });
  }

  const unitId = payload.id ?? nextId();
  const unit: CodeUnit = {
    id: unitId,
    name: payload.name,
    kind: payload.kind,
    layer: payload.layer ?? DEFAULT_LAYER_BY_UNIT_KIND[payload.kind],
    description: payload.description ?? '',
  };

  const views = project.views.map((view) =>
    view.scope.level === 'internal' && view.scope.serviceId === payload.serviceId
      ? {
          ...view,
          nodePositions: {
            ...view.nodePositions,
            [unitId]: { x: payload.position.x, y: payload.position.y },
          },
        }
      : view,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: {
        ...internal,
        units: [...internal.units, unit],
      },
    },
    views,
  });
}

export interface UpdateCodeUnitPayload {
  readonly serviceId: EntityId;
  readonly id: EntityId;
  readonly name?: string;
  readonly kind?: CodeUnitKind;
  readonly layer?: CodeLayer;
  readonly description?: string;
}

export function updateCodeUnit(
  project: ArchitectureProject,
  payload: UpdateCodeUnitPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não encontrada.`,
    });
  }

  const exists = internal.units.some((u) => u.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `CodeUnit "${payload.id}" não encontrada no serviço "${payload.serviceId}".`,
    });
  }

  const units = internal.units.map((u) =>
    u.id === payload.id
      ? {
          ...u,
          name: payload.name ?? u.name,
          kind: payload.kind ?? u.kind,
          layer: payload.layer ?? u.layer,
          description: payload.description ?? u.description,
        }
      : u,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: { ...internal, units },
    },
  });
}

export interface DeleteCodeUnitPayload {
  readonly serviceId: EntityId;
  readonly id: EntityId;
}

export function deleteCodeUnit(
  project: ArchitectureProject,
  payload: DeleteCodeUnitPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não encontrada.`,
    });
  }

  const exists = internal.units.some((u) => u.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `CodeUnit "${payload.id}" não encontrada no serviço "${payload.serviceId}".`,
    });
  }

  const units = internal.units.filter((u) => u.id !== payload.id);
  const dependencies = internal.dependencies.filter(
    (d) => d.sourceId !== payload.id && d.targetId !== payload.id,
  );
  const bindings = project.bindings.filter(
    (b) => !(b.serviceId === payload.serviceId && b.adapterUnitId === payload.id),
  );
  const views = project.views.map((view) =>
    view.scope.level === 'internal' && view.scope.serviceId === payload.serviceId
      ? { ...view, nodePositions: omitKey(view.nodePositions, payload.id) }
      : view,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: { ...internal, units, dependencies },
    },
    bindings,
    views,
  });
}

export interface AddStaticDependencyPayload {
  readonly serviceId: EntityId;
  readonly id?: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: StaticDependencyKind;
  readonly label?: string;
}

export function addStaticDependency(
  project: ArchitectureProject,
  payload: AddStaticDependencyPayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não encontrada.`,
    });
  }

  const dep: StaticDependency = {
    id: payload.id ?? nextId(),
    sourceId: payload.sourceId,
    targetId: payload.targetId,
    kind: payload.kind,
    ...(payload.label !== undefined ? { label: payload.label } : {}),
  };

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: {
        ...internal,
        dependencies: [...internal.dependencies, dep],
      },
    },
  });
}

export interface UpdateStaticDependencyPayload {
  readonly serviceId: EntityId;
  readonly id: EntityId;
  readonly kind?: StaticDependencyKind;
  readonly label?: string | null;
}

export function updateStaticDependency(
  project: ArchitectureProject,
  payload: UpdateStaticDependencyPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não encontrada.`,
    });
  }

  const exists = internal.dependencies.some((d) => d.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `StaticDependency "${payload.id}" não encontrada no serviço "${payload.serviceId}".`,
    });
  }

  const dependencies = internal.dependencies.map((dep) => {
    if (dep.id !== payload.id) return dep;
    const nextLabel =
      payload.label === null
        ? undefined
        : payload.label !== undefined
          ? payload.label
          : dep.label;
    return {
      id: dep.id,
      sourceId: dep.sourceId,
      targetId: dep.targetId,
      kind: payload.kind ?? dep.kind,
      ...(nextLabel !== undefined ? { label: nextLabel } : {}),
    };
  });

  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: { ...internal, dependencies },
    },
  });
}

export interface DeleteStaticDependencyPayload {
  readonly serviceId: EntityId;
  readonly id: EntityId;
}

export function deleteStaticDependency(
  project: ArchitectureProject,
  payload: DeleteStaticDependencyPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const internal = Object.hasOwn(project.internals, payload.serviceId)
    ? project.internals[payload.serviceId]
    : undefined;
  if (!internal) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.serviceId,
      message: `Arquitetura interna do serviço "${payload.serviceId}" não encontrada.`,
    });
  }

  const exists = internal.dependencies.some((d) => d.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `StaticDependency "${payload.id}" não encontrada no serviço "${payload.serviceId}".`,
    });
  }

  const dependencies = internal.dependencies.filter((d) => d.id !== payload.id);
  return finalize({
    ...project,
    updatedAt: nowIso,
    internals: {
      ...project.internals,
      [payload.serviceId]: { ...internal, dependencies },
    },
  });
}

export interface AddBoundaryBindingPayload {
  readonly id?: EntityId;
  readonly serviceId: EntityId;
  readonly runtimeConnectionId: EntityId;
  readonly adapterUnitId: EntityId;
}

export function addBoundaryBinding(
  project: ArchitectureProject,
  payload: AddBoundaryBindingPayload,
  nowIso: string,
  nextId: () => EntityId = defaultIdGenerator,
): DomainResult<ArchitectureProject> {
  const binding: BoundaryBinding = {
    id: payload.id ?? nextId(),
    serviceId: payload.serviceId,
    runtimeConnectionId: payload.runtimeConnectionId,
    adapterUnitId: payload.adapterUnitId,
  };

  return finalize({
    ...project,
    updatedAt: nowIso,
    bindings: [...project.bindings, binding],
  });
}

export interface DeleteBoundaryBindingPayload {
  readonly id: EntityId;
}

export function deleteBoundaryBinding(
  project: ArchitectureProject,
  payload: DeleteBoundaryBindingPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const exists = project.bindings.some((b) => b.id === payload.id);
  if (!exists) {
    return fail({
      code: 'MISSING_REFERENCE',
      entityId: payload.id,
      message: `BoundaryBinding "${payload.id}" não encontrado.`,
    });
  }

  return finalize({
    ...project,
    updatedAt: nowIso,
    bindings: project.bindings.filter((b) => b.id !== payload.id),
  });
}

export interface SetRuleProfilePayload {
  readonly ruleProfile: RuleProfileId;
}

export function setRuleProfile(
  project: ArchitectureProject,
  payload: SetRuleProfilePayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  return finalize({
    ...project,
    ruleProfile: payload.ruleProfile,
    updatedAt: nowIso,
  });
}

export interface UpdateViewNodePositionsPayload {
  readonly scope: ViewScope;
  readonly positions: Readonly<Record<EntityId, Point2D>>;
}

export function updateViewNodePositions(
  project: ArchitectureProject,
  payload: UpdateViewNodePositionsPayload,
  nowIso: string,
): DomainResult<ArchitectureProject> {
  const targetView = project.views.find((v) => isSameScope(v.scope, payload.scope));
  if (!targetView) {
    return fail({
      code: 'VIEW_PARITY_MISMATCH',
      message: 'Visão correspondente ao escopo informado não encontrada.',
    });
  }

  const nextPositions: Record<EntityId, Point2D> = { ...targetView.nodePositions };
  for (const id of Object.keys(payload.positions)) {
    if (!Object.hasOwn(payload.positions, id)) continue;
    const pt = payload.positions[id];
    if (pt !== undefined) {
      nextPositions[id] = { x: pt.x, y: pt.y };
    }
  }

  const views = project.views.map((v) =>
    v.id === targetView.id ? { ...v, nodePositions: nextPositions } : v,
  );

  return finalize({
    ...project,
    updatedAt: nowIso,
    views,
  });
}
