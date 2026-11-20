import {
  MAX_BINDINGS,
  MAX_SERVICES,
  MAX_TOTAL_EDGES,
  MAX_TOTAL_NODES,
  MAX_VIEWS,
} from './limits';
import type {
  ArchitectureProject,
  EntityId,
  Point2D,
  StructuralViolation,
  SystemNode,
} from './types';

function isFinitePoint(point: Point2D | undefined): point is Point2D {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function validateStructuralInvariants(
  project: ArchitectureProject,
): readonly StructuralViolation[] {
  const violations: StructuralViolation[] = [];

  const seenIds = new Set<EntityId>();
  const registerUniqueId = (id: EntityId, kindLabel: string): void => {
    if (seenIds.has(id)) {
      violations.push({
        code: 'DUPLICATE_ID',
        entityId: id,
        message: `ID duplicado detectado (${kindLabel}): "${id}".`,
      });
    } else {
      seenIds.add(id);
    }
  };

  // 1. System nodes
  const systemNodesById = new Map<EntityId, SystemNode>();
  let serviceCount = 0;
  for (const node of project.topology.nodes) {
    registerUniqueId(node.id, 'SystemNode');
    if (!systemNodesById.has(node.id)) {
      systemNodesById.set(node.id, node);
    }
    if (node.kind === 'service') {
      serviceCount++;
    }
  }

  // 2. Runtime connections
  const connectionsById = new Map(project.topology.connections.map((c) => [c.id, c]));
  for (const conn of project.topology.connections) {
    registerUniqueId(conn.id, 'RuntimeConnection');
    if (conn.sourceId === conn.targetId) {
      violations.push({
        code: 'SELF_LOOP',
        entityId: conn.id,
        message: `Conexão de runtime "${conn.id}" não pode conectar o nó "${conn.sourceId}" a si mesmo.`,
      });
    }
    if (!systemNodesById.has(conn.sourceId)) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: conn.id,
        message: `Conexão de runtime "${conn.id}" referencia nó de origem inexistente "${conn.sourceId}".`,
      });
    }
    if (!systemNodesById.has(conn.targetId)) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: conn.id,
        message: `Conexão de runtime "${conn.id}" referencia nó de destino inexistente "${conn.targetId}".`,
      });
    }
  }

  // 3. Internal architectures
  let totalInternalUnits = 0;
  let totalStaticDeps = 0;
  const internalUnitsByService = new Map<EntityId, Set<EntityId>>();

  for (const serviceId of Object.keys(project.internals)) {
    if (!Object.hasOwn(project.internals, serviceId)) continue;
    const internal = project.internals[serviceId];
    if (!internal) continue;

    if (internal.serviceId !== serviceId) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: serviceId,
        message: `Chave de internals "${serviceId}" diverge de internal.serviceId "${internal.serviceId}".`,
      });
    }

    const serviceNode = systemNodesById.get(serviceId);
    if (!serviceNode) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: serviceId,
        message: `Arquitetura interna referencia serviço inexistente "${serviceId}".`,
      });
    } else if (serviceNode.kind !== 'service') {
      violations.push({
        code: 'INVALID_DRILLDOWN_TARGET',
        entityId: serviceId,
        message: `Nó "${serviceId}" do tipo "${serviceNode.kind}" não suporta arquitetura interna (apenas "service").`,
      });
    }

    const unitIds = new Set<EntityId>();
    internalUnitsByService.set(serviceId, unitIds);

    for (const unit of internal.units) {
      registerUniqueId(unit.id, 'CodeUnit');
      unitIds.add(unit.id);
      totalInternalUnits++;
    }

    for (const dep of internal.dependencies) {
      registerUniqueId(dep.id, 'StaticDependency');
      totalStaticDeps++;
      if (dep.sourceId === dep.targetId) {
        violations.push({
          code: 'SELF_LOOP',
          entityId: dep.id,
          message: `Dependência estática "${dep.id}" não pode conectar a unidade "${dep.sourceId}" a si mesma.`,
        });
      }
      if (!unitIds.has(dep.sourceId)) {
        violations.push({
          code: 'MISSING_REFERENCE',
          entityId: dep.id,
          message: `Dependência estática "${dep.id}" referencia unidade de origem inexistente "${dep.sourceId}" no serviço "${serviceId}".`,
        });
      }
      if (!unitIds.has(dep.targetId)) {
        violations.push({
          code: 'MISSING_REFERENCE',
          entityId: dep.id,
          message: `Dependência estática "${dep.id}" referencia unidade de destino inexistente "${dep.targetId}" no serviço "${serviceId}".`,
        });
      }
    }
  }

  // 4. Boundary bindings
  const seenBindingTuples = new Set<string>();
  for (const binding of project.bindings) {
    registerUniqueId(binding.id, 'BoundaryBinding');

    const tupleKey = `${binding.serviceId}\0${binding.runtimeConnectionId}\0${binding.adapterUnitId}`;
    if (seenBindingTuples.has(tupleKey)) {
      violations.push({
        code: 'DUPLICATE_BINDING',
        entityId: binding.id,
        message: `BoundaryBinding duplicado para tupla (${binding.serviceId}, ${binding.runtimeConnectionId}, ${binding.adapterUnitId}).`,
      });
    } else {
      seenBindingTuples.add(tupleKey);
    }

    const serviceUnits = internalUnitsByService.get(binding.serviceId);
    if (!serviceUnits) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: binding.id,
        message: `BoundaryBinding "${binding.id}" referencia serviço sem arquitetura interna "${binding.serviceId}".`,
      });
    } else if (!serviceUnits.has(binding.adapterUnitId)) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: binding.id,
        message: `BoundaryBinding "${binding.id}" referencia unidade inexistente "${binding.adapterUnitId}" no serviço "${binding.serviceId}".`,
      });
    }

    const conn = connectionsById.get(binding.runtimeConnectionId);
    if (!conn) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: binding.id,
        message: `BoundaryBinding "${binding.id}" referencia conexão externa inexistente "${binding.runtimeConnectionId}".`,
      });
    } else if (conn.sourceId !== binding.serviceId && conn.targetId !== binding.serviceId) {
      violations.push({
        code: 'MISSING_REFERENCE',
        entityId: binding.id,
        message: `Conexão "${binding.runtimeConnectionId}" não incide no serviço "${binding.serviceId}" do BoundaryBinding "${binding.id}".`,
      });
    }
  }

  // 5. Views parity & coordinates
  let systemViewCount = 0;
  const internalViewServiceIds = new Set<EntityId>();

  for (const view of project.views) {
    registerUniqueId(view.id, 'ArchitectureView');

    let expectedElementIds: Set<EntityId>;
    if (view.scope.level === 'system') {
      systemViewCount++;
      expectedElementIds = new Set(systemNodesById.keys());
    } else {
      const sid = view.scope.serviceId;
      if (internalViewServiceIds.has(sid)) {
        violations.push({
          code: 'VIEW_PARITY_MISMATCH',
          entityId: view.id,
          message: `Visão interna duplicada para o serviço "${sid}".`,
        });
      }
      internalViewServiceIds.add(sid);
      const unitIds = internalUnitsByService.get(sid);
      if (!unitIds) {
        violations.push({
          code: 'VIEW_PARITY_MISMATCH',
          entityId: view.id,
          message: `Visão interna "${view.id}" referencia serviço "${sid}" sem entrada em internals.`,
        });
        expectedElementIds = new Set();
      } else {
        expectedElementIds = unitIds;
      }
    }

    // Check every key in view.nodePositions exists in scope and has finite coords
    for (const elementId of Object.keys(view.nodePositions)) {
      if (!Object.hasOwn(view.nodePositions, elementId)) continue;
      if (!expectedElementIds.has(elementId)) {
        violations.push({
          code: 'MISSING_REFERENCE',
          entityId: view.id,
          message: `Visão "${view.id}" possui posição órfã para elemento "${elementId}".`,
        });
      }
      const pt = view.nodePositions[elementId];
      if (!isFinitePoint(pt)) {
        violations.push({
          code: 'INVALID_COORDINATE',
          entityId: elementId,
          message: `Coordenada inválida para elemento "${elementId}" na visão "${view.id}".`,
        });
      }
    }

    // Check every element in scope has a valid coordinate
    for (const elementId of expectedElementIds) {
      if (!Object.hasOwn(view.nodePositions, elementId)) {
        violations.push({
          code: 'INVALID_COORDINATE',
          entityId: elementId,
          message: `Elemento "${elementId}" não possui coordenada na visão "${view.id}".`,
        });
      }
    }
  }

  if (systemViewCount !== 1) {
    violations.push({
      code: 'VIEW_PARITY_MISMATCH',
      message: `O projeto deve conter exatamente 1 visão de escopo "system" (encontradas: ${systemViewCount}).`,
    });
  }

  for (const serviceId of internalUnitsByService.keys()) {
    if (!internalViewServiceIds.has(serviceId)) {
      violations.push({
        code: 'VIEW_PARITY_MISMATCH',
        entityId: serviceId,
        message: `Serviço "${serviceId}" possui entrada em internals sem visão canônica correspondente.`,
      });
    }
  }

  // 6. Cardinality limits
  const totalNodes = project.topology.nodes.length + totalInternalUnits;
  if (totalNodes > MAX_TOTAL_NODES) {
    violations.push({
      code: 'CARDINALITY_EXCEEDED',
      message: `Total de nós (${totalNodes}) excede o limite máximo permitido (${MAX_TOTAL_NODES}).`,
    });
  }

  const totalEdges = project.topology.connections.length + totalStaticDeps;
  if (totalEdges > MAX_TOTAL_EDGES) {
    violations.push({
      code: 'CARDINALITY_EXCEEDED',
      message: `Total de arestas (${totalEdges}) excede o limite máximo permitido (${MAX_TOTAL_EDGES}).`,
    });
  }

  if (project.bindings.length > MAX_BINDINGS) {
    violations.push({
      code: 'CARDINALITY_EXCEEDED',
      message: `Total de BoundaryBindings (${project.bindings.length}) excede o limite máximo permitido (${MAX_BINDINGS}).`,
    });
  }

  if (serviceCount > MAX_SERVICES) {
    violations.push({
      code: 'CARDINALITY_EXCEEDED',
      message: `Total de serviços (${serviceCount}) excede o limite máximo permitido (${MAX_SERVICES}).`,
    });
  }

  if (project.views.length > MAX_VIEWS) {
    violations.push({
      code: 'CARDINALITY_EXCEEDED',
      message: `Total de visões (${project.views.length}) excede o limite máximo permitido (${MAX_VIEWS}).`,
    });
  }

  return violations;
}
