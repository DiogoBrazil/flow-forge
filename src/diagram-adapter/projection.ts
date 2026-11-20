import { deriveProjectedEndpoints } from '@domain/projection';
import type {
  ArchitectureProject,
  CodeUnitKind,
  EntityId,
  RuntimeProtocol,
  SystemNodeKind,
  ViewScope,
} from '@domain/types';
import type { Diagnostic, DiagnosticSeverity } from '@rules/types';
import type {
  DiagramEdgeViewModel,
  DiagramNodeViewModel,
  DiagramViewModel,
  NodeBadgeViewModel,
} from './viewModel';

const SYSTEM_NODE_LABELS: Readonly<Record<SystemNodeKind, string>> = {
  client: 'Client',
  gateway: 'Gateway',
  service: 'Service',
  database: 'Database',
  cache: 'Cache',
  broker: 'Broker',
  'external-system': 'External',
};

const CODE_UNIT_LABELS: Readonly<Record<CodeUnitKind, string>> = {
  'inbound-adapter': 'Inbound Adapter',
  'outbound-adapter': 'Outbound Adapter',
  'use-case': 'Use Case',
  'domain-service': 'Domain Service',
  'domain-entity': 'Domain Entity',
  interface: 'Interface',
};

const PROTOCOL_LABELS: Readonly<Record<RuntimeProtocol, string>> = {
  http: 'HTTP',
  grpc: 'gRPC',
  sql: 'SQL',
  redis: 'Redis',
  amqp: 'AMQP',
  kafka: 'Kafka',
  custom: 'Custom',
};

function mergeSeverity(
  current: DiagnosticSeverity | null,
  next: DiagnosticSeverity,
): DiagnosticSeverity {
  if (current === 'error' || next === 'error') return 'error';
  return 'warning';
}

function buildSeverityMap(
  diagnostics: readonly Diagnostic[],
  activeScope: ViewScope,
): Map<EntityId, DiagnosticSeverity> {
  const map = new Map<EntityId, DiagnosticSeverity>();
  for (const diag of diagnostics) {
    const sameScope =
      diag.scope.level === activeScope.level &&
      (diag.scope.level === 'system' ||
        (activeScope.level === 'internal' && diag.scope.serviceId === activeScope.serviceId));
    if (!sameScope) continue;
    for (const target of diag.targets) {
      map.set(target.id, mergeSeverity(map.get(target.id) ?? null, diag.severity));
    }
  }
  return map;
}

export function projectToDiagramViewModel(
  project: ArchitectureProject,
  activeScope: ViewScope,
  diagnostics: readonly Diagnostic[],
  highlightedIds: ReadonlySet<EntityId> = new Set(),
): DiagramViewModel {
  const severityById = buildSeverityMap(diagnostics, activeScope);

  if (activeScope.level === 'system') {
    const systemView = project.views.find((v) => v.scope.level === 'system');
    const nodes: DiagramNodeViewModel[] = project.topology.nodes.map((node) => ({
      id: node.id,
      label: node.name,
      kind: node.kind,
      kindLabel: SYSTEM_NODE_LABELS[node.kind],
      ...(node.technology !== undefined ? { technology: node.technology } : {}),
      position: systemView?.nodePositions[node.id] ?? { x: 0, y: 0 },
      drillable: node.kind === 'service',
      badges: [],
      diagnosticSeverity: severityById.get(node.id) ?? null,
      highlighted: highlightedIds.has(node.id),
    }));

    const edges: DiagramEdgeViewModel[] = project.topology.connections.map((conn) => {
      const proto = PROTOCOL_LABELS[conn.protocol];
      const label = conn.label ? `${proto}: ${conn.label}` : proto;
      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        label,
        styleKind: conn.kind,
        diagnosticSeverity: severityById.get(conn.id) ?? null,
        highlighted: highlightedIds.has(conn.id),
      };
    });

    return { nodes, edges };
  }

  const serviceId = activeScope.serviceId;
  const internal = Object.hasOwn(project.internals, serviceId)
    ? project.internals[serviceId]
    : undefined;
  const internalView = project.views.find(
    (v) => v.scope.level === 'internal' && v.scope.serviceId === serviceId,
  );

  if (!internal) {
    return { nodes: [], edges: [] };
  }

  const endpoints = deriveProjectedEndpoints(project, serviceId);
  const endpointsByConnId = new Map(endpoints.map((ep) => [ep.runtimeConnectionId, ep]));

  const bindingsByUnitId = new Map<EntityId, NodeBadgeViewModel[]>();
  for (const binding of project.bindings) {
    if (binding.serviceId !== serviceId) continue;
    const ep = endpointsByConnId.get(binding.runtimeConnectionId);
    if (!ep) continue;
    const arrow = ep.direction === 'inbound' ? '←' : '→';
    const proto = PROTOCOL_LABELS[ep.protocol];
    const list = bindingsByUnitId.get(binding.adapterUnitId) ?? [];
    list.push({
      text: `${arrow} ${proto}: ${ep.peerNodeName}`,
      variant: 'bound',
    });
    bindingsByUnitId.set(binding.adapterUnitId, list);
  }

  const nodes: DiagramNodeViewModel[] = internal.units.map((unit) => {
    const isAdapter = unit.kind === 'inbound-adapter' || unit.kind === 'outbound-adapter';
    const boundBadges = bindingsByUnitId.get(unit.id) ?? [];
    const badges: NodeBadgeViewModel[] =
      isAdapter && boundBadges.length === 0
        ? [{ text: '⚠ Sem vínculo externo', variant: 'warning' }]
        : boundBadges;

    return {
      id: unit.id,
      label: unit.name,
      kind: unit.kind,
      kindLabel: CODE_UNIT_LABELS[unit.kind],
      layer: unit.layer,
      position: internalView?.nodePositions[unit.id] ?? { x: 0, y: 0 },
      drillable: false,
      badges,
      diagnosticSeverity: severityById.get(unit.id) ?? null,
      highlighted: highlightedIds.has(unit.id),
    };
  });

  const edges: DiagramEdgeViewModel[] = internal.dependencies.map((dep) => {
    const baseLabel = dep.kind === 'implements' ? 'implements' : 'depends-on';
    const label = dep.label ? `${baseLabel}: ${dep.label}` : baseLabel;
    return {
      id: dep.id,
      source: dep.sourceId,
      target: dep.targetId,
      label,
      styleKind: dep.kind,
      diagnosticSeverity: severityById.get(dep.id) ?? null,
      highlighted: highlightedIds.has(dep.id),
    };
  });

  return { nodes, edges };
}
