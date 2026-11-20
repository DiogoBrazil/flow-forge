import { deriveBindingDirection, deriveProjectedEndpoints } from '@domain/projection';
import type {
  ArchitectureProject,
  CodeLayer,
  CodeUnit,
  InternalArchitecture,
  RuleProfileId,
  RuntimeConnection,
  SystemNode,
  ViewScope,
} from '@domain/types';
import { findStronglyConnectedCycles } from './tarjan';
import { buildDiagnosticId } from './types';
import type { ArchitectureRule, Diagnostic, DiagnosticSeverity, DiagnosticTarget } from './types';

function createDiagnostic(params: {
  ruleId: string;
  severity: DiagnosticSeverity;
  scope: ViewScope;
  title: string;
  message: string;
  suggestion: string;
  targets: readonly DiagnosticTarget[];
  evidence: Readonly<Record<string, unknown>>;
}): Diagnostic {
  return {
    id: buildDiagnosticId(params.ruleId, params.scope, params.targets),
    ...params,
  };
}

function getPopulatedInternals(
  project: ArchitectureProject,
): readonly { readonly serviceId: string; readonly internal: InternalArchitecture }[] {
  const entries: { serviceId: string; internal: InternalArchitecture }[] = [];
  const keys = Object.keys(project.internals)
    .filter((k) => Object.hasOwn(project.internals, k))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const serviceId of keys) {
    const internal = project.internals[serviceId];
    if (internal && internal.units.length > 0) {
      entries.push({ serviceId, internal });
    }
  }
  return entries;
}

const FORBIDDEN_LAYER_TRANSITIONS: Readonly<
  Record<RuleProfileId, ReadonlySet<`${CodeLayer}->${CodeLayer}`>>
> = {
  hexagonal: new Set<`${CodeLayer}->${CodeLayer}`>([
    'application->adapters',
    'domain->adapters',
    'domain->application',
  ]),
  layered: new Set<`${CodeLayer}->${CodeLayer}`>([
    'adapters->domain',
    'application->adapters',
    'domain->adapters',
    'domain->application',
  ]),
  'distributed-baseline': new Set<`${CodeLayer}->${CodeLayer}`>(),
};

export function isLayerTransitionAllowed(
  profile: RuleProfileId,
  sourceLayer: CodeLayer,
  targetLayer: CodeLayer,
): boolean {
  return !FORBIDDEN_LAYER_TRANSITIONS[profile].has(`${sourceLayer}->${targetLayer}`);
}

/**
 * 1. LAYER_VIOLATION
 */
export const layerViolationRule: ArchitectureRule = (project) => {
  if (project.ruleProfile === 'distributed-baseline') {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const unitsById = new Map<string, CodeUnit>(internal.units.map((u) => [u.id, u]));
    const scope: ViewScope = { level: 'internal', serviceId };

    for (const dep of internal.dependencies) {
      const source = unitsById.get(dep.sourceId);
      const target = unitsById.get(dep.targetId);
      if (!source || !target) continue;

      if (!isLayerTransitionAllowed(project.ruleProfile, source.layer, target.layer)) {
        diagnostics.push(
          createDiagnostic({
            ruleId: 'LAYER_VIOLATION',
            severity: 'error',
            scope,
            title: 'Violação de dependência entre camadas',
            message: `"${source.name}" (${source.layer}) não pode ter dependência "${dep.kind}" para "${target.name}" (${target.layer}) no perfil "${project.ruleProfile}".`,
            suggestion:
              'Inverta a dependência introduzindo uma Interface na camada permitida ou mova o componente para a camada adequada.',
            targets: [
              { kind: 'static-dependency', id: dep.id },
              { kind: 'code-unit', id: source.id },
              { kind: 'code-unit', id: target.id },
            ],
            evidence: {
              dependencyId: dep.id,
              sourceLayer: source.layer,
              targetLayer: target.layer,
              dependencyKind: dep.kind,
              profile: project.ruleProfile,
            },
          }),
        );
      }
    }
  }
  return diagnostics;
};

/**
 * 2. STATIC_DEPENDENCY_CYCLE
 */
export const staticDependencyCycleRule: ArchitectureRule = (project) => {
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const unitNames = new Map(internal.units.map((u) => [u.id, u.name]));
    const cycles = findStronglyConnectedCycles(
      internal.units.map((u) => u.id),
      internal.dependencies.map((d) => ({ source: d.sourceId, target: d.targetId })),
    );

    for (const cycleUnitIds of cycles) {
      const names = cycleUnitIds.map((id) => unitNames.get(id) ?? id).join(' ↔ ');
      diagnostics.push(
        createDiagnostic({
          ruleId: 'STATIC_DEPENDENCY_CYCLE',
          severity: 'error',
          scope,
          title: 'Ciclo de dependência estática',
          message: `Detectado ciclo de dependência interna envolvendo: ${names}.`,
          suggestion:
            'Quebre o ciclo extraindo uma Interface ou redistribuindo responsabilidades entre os componentes.',
          targets: cycleUnitIds.map((id) => ({ kind: 'code-unit', id })),
          evidence: { cycleUnitIds },
        }),
      );
    }
  }
  return diagnostics;
};

/**
 * 3. DISTRIBUTED_DEPENDENCY_CYCLE
 */
export const distributedDependencyCycleRule: ArchitectureRule = (project) => {
  const scope: ViewScope = { level: 'system' };
  const nodeNames = new Map(project.topology.nodes.map((n) => [n.id, n.name]));
  const syncEdges = project.topology.connections
    .filter((c) => c.kind === 'sync-call')
    .map((c) => ({ source: c.sourceId, target: c.targetId }));

  const cycles = findStronglyConnectedCycles(
    project.topology.nodes.map((n) => n.id),
    syncEdges,
  );

  return cycles.map((cycleNodeIds) => {
    const names = cycleNodeIds.map((id) => nodeNames.get(id) ?? id).join(' ↔ ');
    return createDiagnostic({
      ruleId: 'DISTRIBUTED_DEPENDENCY_CYCLE',
      severity: 'warning',
      scope,
      title: 'Ciclo de chamadas síncronas distribuídas',
      message: `Detectado ciclo de chamadas síncronas (sync-call) entre: ${names}.`,
      suggestion:
        'Considere desacoplar uma das direções com mensageria assíncrona (broker) ou reorganizar limites de serviço.',
      targets: cycleNodeIds.map((id) => ({ kind: 'system-node', id })),
      evidence: { cycleNodeIds },
    });
  });
};

/**
 * 4. UNIMPLEMENTED_INTERFACE
 */
export const unimplementedInterfaceRule: ArchitectureRule = (project) => {
  const severity: DiagnosticSeverity = project.ruleProfile === 'hexagonal' ? 'error' : 'warning';
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const implementedTargets = new Set(
      internal.dependencies.filter((d) => d.kind === 'implements').map((d) => d.targetId),
    );

    for (const unit of internal.units) {
      if (unit.kind === 'interface' && !implementedTargets.has(unit.id)) {
        diagnostics.push(
          createDiagnostic({
            ruleId: 'UNIMPLEMENTED_INTERFACE',
            severity,
            scope,
            title: 'Interface sem implementação',
            message: `A Interface "${unit.name}" não possui nenhuma aresta "implements" apontando para ela.`,
            suggestion:
              'Adicione um adaptador ou componente concreto com aresta "implements" apontando para esta Interface.',
            targets: [{ kind: 'code-unit', id: unit.id }],
            evidence: { interfaceUnitId: unit.id },
          }),
        );
      }
    }
  }
  return diagnostics;
};

/**
 * 5. INVALID_IMPLEMENTS_TARGET
 */
export const invalidImplementsTargetRule: ArchitectureRule = (project) => {
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const unitsById = new Map(internal.units.map((u) => [u.id, u]));

    for (const dep of internal.dependencies) {
      if (dep.kind !== 'implements') continue;
      const target = unitsById.get(dep.targetId);
      if (!target || target.kind === 'interface') continue;

      diagnostics.push(
        createDiagnostic({
          ruleId: 'INVALID_IMPLEMENTS_TARGET',
          severity: 'error',
          scope,
          title: 'Alvo inválido para relação "implements"',
          message: `A aresta "implements" aponta para "${target.name}" (tipo "${target.kind}"), que não é uma Interface.`,
          suggestion:
            'Altere o tipo da aresta para "depends-on" ou direcione "implements" para um elemento do tipo "interface".',
          targets: [
            { kind: 'static-dependency', id: dep.id },
            { kind: 'code-unit', id: target.id },
          ],
          evidence: {
            dependencyId: dep.id,
            targetKind: target.kind,
          },
        }),
      );
    }
  }
  return diagnostics;
};

function evaluateRuntimeConnectionCompatibility(
  conn: RuntimeConnection,
  source: SystemNode,
  target: SystemNode,
): readonly { readonly severity: DiagnosticSeverity; readonly reason: string; readonly message: string; readonly suggestion: string }[] {
  const issues: {
    severity: DiagnosticSeverity;
    reason: string;
    message: string;
    suggestion: string;
  }[] = [];

  // (1) client -> database or client -> cache (error)
  if (source.kind === 'client' && (target.kind === 'database' || target.kind === 'cache')) {
    issues.push({
      severity: 'error',
      reason: 'CLIENT_DIRECT_DATA_ACCESS',
      message: `Cliente "${source.name}" não deve acessar diretamente "${target.name}" (${target.kind}).`,
      suggestion: 'Intermedie o acesso através de um Gateway ou Serviço.',
    });
  }

  // (2) database or cache as source of any connection (error)
  if (source.kind === 'database' || source.kind === 'cache') {
    issues.push({
      severity: 'error',
      reason: 'PASSIVE_STORE_AS_SOURCE',
      message: `"${source.name}" (${source.kind}) não pode ser a origem de uma conexão de runtime.`,
      suggestion: 'Inverta a direção da conexão para que o serviço inicie o acesso aos dados/cache.',
    });
  }

  // (3) data-access requires target.kind === 'database' (error)
  if (conn.kind === 'data-access' && target.kind !== 'database') {
    issues.push({
      severity: 'error',
      reason: 'DATA_ACCESS_NON_DATABASE',
      message: `Conexão "data-access" deve apontar para um "database", mas aponta para "${target.name}" (${target.kind}).`,
      suggestion: 'Altere o tipo da conexão ou reconecte-a a um nó do tipo "database".',
    });
  }

  // (4) cache-access requires target.kind === 'cache' (error)
  if (conn.kind === 'cache-access' && target.kind !== 'cache') {
    issues.push({
      severity: 'error',
      reason: 'CACHE_ACCESS_NON_CACHE',
      message: `Conexão "cache-access" deve apontar para um "cache", mas aponta para "${target.name}" (${target.kind}).`,
      suggestion: 'Altere o tipo da conexão ou reconecte-a a um nó do tipo "cache".',
    });
  }

  // (5) async-publish requires target.kind === 'broker' (error)
  if (conn.kind === 'async-publish' && target.kind !== 'broker') {
    issues.push({
      severity: 'error',
      reason: 'ASYNC_PUBLISH_NON_BROKER',
      message: `Conexão "async-publish" exige destino do tipo "broker", mas aponta para "${target.name}" (${target.kind}).`,
      suggestion: 'Direcione a publicação de eventos para um nó "broker" (Produtor → Broker).',
    });
  }

  // (6) async-consume requires source.kind === 'broker' (error)
  if (conn.kind === 'async-consume' && source.kind !== 'broker') {
    issues.push({
      severity: 'error',
      reason: 'ASYNC_CONSUME_NON_BROKER',
      message: `Conexão "async-consume" exige origem do tipo "broker", mas parte de "${source.name}" (${source.kind}).`,
      suggestion: 'Modele o consumo no sentido do fluxo da mensagem: Broker → Consumidor.',
    });
  }

  // (7) service -> client with sync-call (warning)
  if (source.kind === 'service' && target.kind === 'client' && conn.kind === 'sync-call') {
    issues.push({
      severity: 'warning',
      reason: 'SERVICE_SYNC_CALL_TO_CLIENT',
      message: `Serviço "${source.name}" faz chamada síncrona ("sync-call") para cliente "${target.name}".`,
      suggestion: 'Verifique se a seta não está invertida (Cliente → Gateway/Serviço).',
    });
  }

  // (8) protocol compatibility with connectionKind (warning; custom accepted in all)
  if (conn.protocol !== 'custom') {
    const protocolMismatch =
      (conn.protocol === 'sql' && conn.kind !== 'data-access') ||
      (conn.protocol === 'redis' && conn.kind !== 'cache-access') ||
      ((conn.protocol === 'amqp' || conn.protocol === 'kafka') &&
        conn.kind !== 'async-publish' &&
        conn.kind !== 'async-consume');

    if (protocolMismatch) {
      issues.push({
        severity: 'warning',
        reason: 'PROTOCOL_KIND_MISMATCH',
        message: `Protocolo "${conn.protocol}" é incompatível com o tipo de conexão "${conn.kind}" entre "${source.name}" e "${target.name}".`,
        suggestion:
          'Alinhe o protocolo ao tipo de conexão (sql→data-access, redis→cache-access, amqp/kafka→async-*) ou use "custom".',
      });
    }
  }

  return issues;
}

/**
 * 6. INCOMPATIBLE_RUNTIME_CONNECTION
 */
export const incompatibleRuntimeConnectionRule: ArchitectureRule = (project) => {
  const scope: ViewScope = { level: 'system' };
  const nodesById = new Map(project.topology.nodes.map((n) => [n.id, n]));
  const diagnostics: Diagnostic[] = [];

  for (const conn of project.topology.connections) {
    const source = nodesById.get(conn.sourceId);
    const target = nodesById.get(conn.targetId);
    if (!source || !target) continue;

    const issues = evaluateRuntimeConnectionCompatibility(conn, source, target);
    for (const issue of issues) {
      const targets: DiagnosticTarget[] = [
        { kind: 'runtime-connection', id: conn.id },
        { kind: 'system-node', id: source.id },
        { kind: 'system-node', id: target.id },
      ];
      // Ensure distinct IDs when multiple reasons apply to the same connection
      const baseId = buildDiagnosticId('INCOMPATIBLE_RUNTIME_CONNECTION', scope, targets);
      diagnostics.push({
        id: issues.length > 1 ? `${baseId}:${issue.reason}` : baseId,
        ruleId: 'INCOMPATIBLE_RUNTIME_CONNECTION',
        severity: issue.severity,
        scope,
        title: 'Conexão de runtime semanticamente incompatível',
        message: issue.message,
        suggestion: issue.suggestion,
        targets,
        evidence: {
          connectionId: conn.id,
          sourceKind: source.kind,
          targetKind: target.kind,
          connectionKind: conn.kind,
          protocol: conn.protocol,
          reason: issue.reason,
        },
      });
    }
  }
  return diagnostics;
};

/**
 * 7. UNBOUND_EXTERNAL_ENDPOINT
 */
export const unboundExternalEndpointRule: ArchitectureRule = (project) => {
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const boundConnectionIds = new Set(
      project.bindings
        .filter((b) => b.serviceId === serviceId)
        .map((b) => b.runtimeConnectionId),
    );
    const endpoints = deriveProjectedEndpoints(project, serviceId);

    for (const ep of endpoints) {
      if (!boundConnectionIds.has(ep.runtimeConnectionId)) {
        diagnostics.push(
          createDiagnostic({
            ruleId: 'UNBOUND_EXTERNAL_ENDPOINT',
            severity: 'warning',
            scope,
            title: 'Endpoint externo sem adaptador vinculado',
            message: `A conexão externa ${ep.direction} (${ep.protocol}) com "${ep.peerNodeName}" não está vinculada a nenhum adaptador interno.`,
            suggestion:
              'Abra a seção "Fronteira Externa" no painel inspetor e vincule este Endpoint a um adaptador interno.',
            targets: [{ kind: 'runtime-connection', id: ep.runtimeConnectionId }],
            evidence: {
              serviceId,
              runtimeConnectionId: ep.runtimeConnectionId,
              direction: ep.direction,
            },
          }),
        );
      }
    }
  }
  return diagnostics;
};

/**
 * 8. UNBOUND_ADAPTER
 */
export const unboundAdapterRule: ArchitectureRule = (project) => {
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const boundUnitIds = new Set(
      project.bindings.filter((b) => b.serviceId === serviceId).map((b) => b.adapterUnitId),
    );

    for (const unit of internal.units) {
      if (
        (unit.kind === 'inbound-adapter' || unit.kind === 'outbound-adapter') &&
        !boundUnitIds.has(unit.id)
      ) {
        diagnostics.push(
          createDiagnostic({
            ruleId: 'UNBOUND_ADAPTER',
            severity: 'warning',
            scope,
            title: 'Adaptador interno sem vínculo de fronteira',
            message: `O adaptador "${unit.name}" (${unit.kind}) não possui nenhum BoundaryBinding associado a uma conexão externa.`,
            suggestion:
              'Vincule este adaptador a um Endpoint externo compatível na seção "Fronteira Externa" do painel inspetor.',
            targets: [{ kind: 'code-unit', id: unit.id }],
            evidence: {
              serviceId,
              adapterUnitId: unit.id,
              adapterKind: unit.kind,
            },
          }),
        );
      }
    }
  }
  return diagnostics;
};

/**
 * 9. BOUNDARY_DIRECTION_MISMATCH
 */
export const boundaryDirectionMismatchRule: ArchitectureRule = (project) => {
  const diagnostics: Diagnostic[] = [];

  for (const { serviceId, internal } of getPopulatedInternals(project)) {
    const scope: ViewScope = { level: 'internal', serviceId };
    const unitsById = new Map(internal.units.map((u) => [u.id, u]));

    for (const binding of project.bindings) {
      if (binding.serviceId !== serviceId) continue;
      const unit = unitsById.get(binding.adapterUnitId);
      const derivedDirection = deriveBindingDirection(project, binding);
      if (!unit || !derivedDirection) continue;

      const isMismatch =
        (unit.kind !== 'inbound-adapter' && unit.kind !== 'outbound-adapter') ||
        (unit.kind === 'inbound-adapter' && derivedDirection !== 'inbound') ||
        (unit.kind === 'outbound-adapter' && derivedDirection !== 'outbound');

      if (isMismatch) {
        diagnostics.push(
          createDiagnostic({
            ruleId: 'BOUNDARY_DIRECTION_MISMATCH',
            severity: 'error',
            scope,
            title: 'Incompatibilidade de direção no Boundary Binding',
            message: `O vínculo liga "${unit.name}" (${unit.kind}) a uma conexão externa cuja direção derivada é "${derivedDirection}".`,
            suggestion:
              'Vincule "inbound-adapter" apenas a Endpoints inbound e "outbound-adapter" apenas a Endpoints outbound (ou corrija a direção da conexão na topologia).',
            targets: [
              { kind: 'boundary-binding', id: binding.id },
              { kind: 'code-unit', id: unit.id },
              { kind: 'runtime-connection', id: binding.runtimeConnectionId },
            ],
            evidence: {
              bindingId: binding.id,
              adapterKind: unit.kind,
              derivedDirection,
            },
          }),
        );
      }
    }
  }
  return diagnostics;
};

export const ALL_ARCHITECTURE_RULES: readonly ArchitectureRule[] = [
  layerViolationRule,
  staticDependencyCycleRule,
  distributedDependencyCycleRule,
  unimplementedInterfaceRule,
  invalidImplementsTargetRule,
  incompatibleRuntimeConnectionRule,
  unboundExternalEndpointRule,
  unboundAdapterRule,
  boundaryDirectionMismatchRule,
];
