import { describe, expect, it } from 'vitest';
import {
  addBoundaryBinding,
  addCodeUnit,
  addRuntimeConnection,
  addStaticDependency,
  addSystemNode,
  changeSystemNodeKind,
  clearInternalArchitectureAndChangeKind,
  createEmptyProject,
  deleteBoundaryBinding,
  deleteCodeUnit,
  deleteRuntimeConnection,
  deleteStaticDependency,
  deleteSystemNode,
  ensureInternalArchitecture,
  reconnectRuntimeConnection,
  setRuleProfile,
  updateCodeUnit,
  updateRuntimeConnection,
  updateStaticDependency,
  updateSystemNode,
  updateViewNodePositions,
} from '@domain/commands';
import { validateStructuralInvariants } from '@domain/invariants';
import { DEFAULT_LAYER_BY_UNIT_KIND, MAX_TOTAL_NODES } from '@domain/limits';
import { deriveBindingDirection, deriveProjectedEndpoints } from '@domain/projection';
import type { ArchitectureProject, DomainResult } from '@domain/types';

const NOW = '2026-11-20T12:00:00.000Z';

function unwrap(res: DomainResult<ArchitectureProject>): ArchitectureProject {
  if (!res.ok) {
    throw new Error(`Expected ok result, got violations: ${JSON.stringify(res.violations)}`);
  }
  return res.value;
}

function buildOrdersProject(): ArchitectureProject {
  let p = unwrap(
    createEmptyProject(
      { id: 'proj-1', name: 'Orders System', systemViewId: 'view-sys' },
      NOW,
    ),
  );
  p = unwrap(
    addSystemNode(p, { id: 'gw', name: 'API Gateway', kind: 'gateway', position: { x: 0, y: 0 } }, NOW),
  );
  p = unwrap(
    addSystemNode(
      p,
      { id: 'orders', name: 'Orders API', kind: 'service', technology: 'Node', position: { x: 250, y: 0 } },
      NOW,
    ),
  );
  p = unwrap(
    addSystemNode(p, { id: 'pg', name: 'PostgreSQL', kind: 'database', position: { x: 500, y: 0 } }, NOW),
  );
  p = unwrap(
    addSystemNode(p, { id: 'redis', name: 'Redis', kind: 'cache', position: { x: 500, y: 150 } }, NOW),
  );
  p = unwrap(
    addRuntimeConnection(
      p,
      { id: 'c-in', sourceId: 'gw', targetId: 'orders', kind: 'sync-call', protocol: 'http', label: 'POST /orders' },
      NOW,
    ),
  );
  p = unwrap(
    addRuntimeConnection(
      p,
      { id: 'c-db', sourceId: 'orders', targetId: 'pg', kind: 'data-access', protocol: 'sql' },
      NOW,
    ),
  );
  p = unwrap(ensureInternalArchitecture(p, { serviceId: 'orders', viewId: 'view-orders' }, NOW));
  p = unwrap(
    addCodeUnit(
      p,
      { serviceId: 'orders', id: 'u-http', name: 'HttpAdapter', kind: 'inbound-adapter', position: { x: 0, y: 0 } },
      NOW,
    ),
  );
  p = unwrap(
    addCodeUnit(
      p,
      { serviceId: 'orders', id: 'u-uc', name: 'CreateOrder', kind: 'use-case', position: { x: 250, y: 0 } },
      NOW,
    ),
  );
  p = unwrap(
    addCodeUnit(
      p,
      { serviceId: 'orders', id: 'u-repo', name: 'OrderRepo', kind: 'interface', position: { x: 500, y: 0 } },
      NOW,
    ),
  );
  p = unwrap(
    addCodeUnit(
      p,
      { serviceId: 'orders', id: 'u-pg', name: 'PgOrderRepo', kind: 'outbound-adapter', position: { x: 500, y: 150 } },
      NOW,
    ),
  );
  p = unwrap(
    addStaticDependency(
      p,
      { serviceId: 'orders', id: 'd-1', sourceId: 'u-http', targetId: 'u-uc', kind: 'depends-on' },
      NOW,
    ),
  );
  p = unwrap(
    addStaticDependency(
      p,
      { serviceId: 'orders', id: 'd-2', sourceId: 'u-pg', targetId: 'u-repo', kind: 'implements' },
      NOW,
    ),
  );
  p = unwrap(
    addBoundaryBinding(
      p,
      { id: 'b-in', serviceId: 'orders', runtimeConnectionId: 'c-in', adapterUnitId: 'u-http' },
      NOW,
    ),
  );
  p = unwrap(
    addBoundaryBinding(
      p,
      { id: 'b-db', serviceId: 'orders', runtimeConnectionId: 'c-db', adapterUnitId: 'u-pg' },
      NOW,
    ),
  );
  return p;
}

describe('Domain commands & structural invariants', () => {
  it('builds a valid two-level project with default layers derived from CodeUnitKind', () => {
    const project = buildOrdersProject();
    expect(validateStructuralInvariants(project)).toEqual([]);

    const units = project.internals['orders']?.units ?? [];
    for (const unit of units) {
      expect(unit.layer).toBe(DEFAULT_LAYER_BY_UNIT_KIND[unit.kind]);
    }
  });

  it('derives ProjectedEndpoints deterministically sorted by (direction, runtimeConnectionId)', () => {
    const project = buildOrdersProject();
    const endpoints = deriveProjectedEndpoints(project, 'orders');
    expect(endpoints).toHaveLength(2);
    expect(endpoints[0]).toMatchObject({
      runtimeConnectionId: 'c-in',
      direction: 'inbound',
      peerNodeId: 'gw',
      peerNodeName: 'API Gateway',
      protocol: 'http',
      label: 'POST /orders',
    });
    expect(endpoints[1]).toMatchObject({
      runtimeConnectionId: 'c-db',
      direction: 'outbound',
      peerNodeId: 'pg',
      peerNodeName: 'PostgreSQL',
      protocol: 'sql',
    });

    expect(deriveBindingDirection(project, project.bindings[0]!)).toBe('inbound');
    expect(deriveBindingDirection(project, project.bindings[1]!)).toBe('outbound');
  });

  it('updates SystemNode, RuntimeConnection, CodeUnit, StaticDependency, ruleProfile and node positions', () => {
    let p = buildOrdersProject();
    p = unwrap(updateSystemNode(p, { id: 'orders', name: 'Orders Core', technology: null }, NOW));
    expect(p.topology.nodes.find((n) => n.id === 'orders')?.name).toBe('Orders Core');
    expect('technology' in (p.topology.nodes.find((n) => n.id === 'orders') ?? {})).toBe(false);

    p = unwrap(updateRuntimeConnection(p, { id: 'c-in', protocol: 'grpc', label: null }, NOW));
    const conn = p.topology.connections.find((c) => c.id === 'c-in');
    expect(conn?.protocol).toBe('grpc');
    expect('label' in (conn ?? {})).toBe(false);

    p = unwrap(updateCodeUnit(p, { serviceId: 'orders', id: 'u-repo', layer: 'domain' }, NOW));
    expect(p.internals['orders']?.units.find((u) => u.id === 'u-repo')?.layer).toBe('domain');

    p = unwrap(updateStaticDependency(p, { serviceId: 'orders', id: 'd-1', label: 'invokes' }, NOW));
    expect(p.internals['orders']?.dependencies.find((d) => d.id === 'd-1')?.label).toBe('invokes');

    p = unwrap(setRuleProfile(p, { ruleProfile: 'layered' }, NOW));
    expect(p.ruleProfile).toBe('layered');

    p = unwrap(
      updateViewNodePositions(p, { scope: { level: 'system' }, positions: { orders: { x: 333, y: 77 } } }, NOW),
    );
    const sysView = p.views.find((v) => v.scope.level === 'system');
    expect(sysView?.nodePositions['orders']).toEqual({ x: 333, y: 77 });
  });

  it('preserves bindings when reconnecting a RuntimeConnection that still touches the service, and cascades when detached', () => {
    const p = buildOrdersProject();

    // Reconnect c-db target from pg -> redis: orders still source -> b-db preserved
    const reconnected = unwrap(reconnectRuntimeConnection(p, { id: 'c-db', targetId: 'redis' }, NOW));
    expect(reconnected.bindings.some((b) => b.id === 'b-db')).toBe(true);
    expect(deriveProjectedEndpoints(reconnected, 'orders').find((e) => e.runtimeConnectionId === 'c-db')?.peerNodeId).toBe(
      'redis',
    );

    // Invert direction of c-db (pg -> orders): b-db preserved, derived direction flips to inbound
    const inverted = unwrap(reconnectRuntimeConnection(p, { id: 'c-db', sourceId: 'pg', targetId: 'orders' }, NOW));
    expect(inverted.bindings.some((b) => b.id === 'b-db')).toBe(true);
    expect(deriveBindingDirection(inverted, inverted.bindings.find((b) => b.id === 'b-db')!)).toBe('inbound');

    // Detach orders from c-db (gw -> pg): b-db cascade-removed
    const detached = unwrap(reconnectRuntimeConnection(p, { id: 'c-db', sourceId: 'gw', targetId: 'pg' }, NOW));
    expect(detached.bindings.some((b) => b.id === 'b-db')).toBe(false);
    expect(validateStructuralInvariants(detached)).toEqual([]);
  });

  it('handles cascade deletions cleanly (connection, code unit, static dependency, boundary binding, system node)', () => {
    const base = buildOrdersProject();

    // Delete RuntimeConnection -> removes its bindings, keeps adapter
    const afterConnDel = unwrap(deleteRuntimeConnection(base, { id: 'c-db' }, NOW));
    expect(afterConnDel.bindings.some((b) => b.id === 'b-db')).toBe(false);
    expect(afterConnDel.internals['orders']?.units.some((u) => u.id === 'u-pg')).toBe(true);

    // Delete CodeUnit -> removes its deps, bindings and nodePositions entry
    const afterUnitDel = unwrap(deleteCodeUnit(base, { serviceId: 'orders', id: 'u-pg' }, NOW));
    expect(afterUnitDel.bindings.some((b) => b.id === 'b-db')).toBe(false);
    expect(afterUnitDel.internals['orders']?.dependencies.some((d) => d.id === 'd-2')).toBe(false);
    const intView = afterUnitDel.views.find((v) => v.scope.level === 'internal');
    expect(intView?.nodePositions['u-pg']).toBeUndefined();

    // Delete StaticDependency & BoundaryBinding directly
    const afterDepDel = unwrap(deleteStaticDependency(base, { serviceId: 'orders', id: 'd-1' }, NOW));
    expect(afterDepDel.internals['orders']?.dependencies.some((d) => d.id === 'd-1')).toBe(false);

    const afterBindDel = unwrap(deleteBoundaryBinding(base, { id: 'b-in' }, NOW));
    expect(afterBindDel.bindings.some((b) => b.id === 'b-in')).toBe(false);

    // Delete SystemNode (service) -> removes node, positions, incident connections, internal arch, internal view, bindings
    const afterNodeDel = unwrap(deleteSystemNode(base, { id: 'orders' }, NOW));
    expect(afterNodeDel.topology.nodes.some((n) => n.id === 'orders')).toBe(false);
    expect(afterNodeDel.topology.connections).toHaveLength(0);
    expect(afterNodeDel.internals['orders']).toBeUndefined();
    expect(afterNodeDel.bindings).toHaveLength(0);
    expect(afterNodeDel.views).toHaveLength(1);
    expect(afterNodeDel.views[0]?.nodePositions['orders']).toBeUndefined();
    expect(validateStructuralInvariants(afterNodeDel)).toEqual([]);
  });

  it('guards SystemNode.kind transition from service to terminal node', () => {
    const p = buildOrdersProject();

    // Blocked while internal architecture has units
    const blocked = changeSystemNodeKind(p, { id: 'orders', kind: 'gateway' }, NOW);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.violations[0]?.code).toBe('NON_EMPTY_INTERNAL_ARCHITECTURE');
    }

    // Explicit clear + change kind succeeds atomically
    const cleared = unwrap(clearInternalArchitectureAndChangeKind(p, { id: 'orders', kind: 'gateway' }, NOW));
    expect(cleared.topology.nodes.find((n) => n.id === 'orders')?.kind).toBe('gateway');
    expect(cleared.internals['orders']).toBeUndefined();
    expect(cleared.bindings).toHaveLength(0);
    expect(cleared.views).toHaveLength(1);

    // Empty internal architecture can change kind directly
    let emptySvc = unwrap(createEmptyProject({ id: 'p2', name: 'P2', systemViewId: 'v-sys' }, NOW));
    emptySvc = unwrap(
      addSystemNode(emptySvc, { id: 's1', name: 'Svc', kind: 'service', position: { x: 0, y: 0 } }, NOW),
    );
    emptySvc = unwrap(ensureInternalArchitecture(emptySvc, { serviceId: 's1', viewId: 'v-s1' }, NOW));
    const changed = unwrap(changeSystemNodeKind(emptySvc, { id: 's1', kind: 'external-system' }, NOW));
    expect(changed.internals['s1']).toBeUndefined();
    expect(changed.views).toHaveLength(1);
  });

  it('rejects all structural invariant violation codes', () => {
    const p = buildOrdersProject();

    // DUPLICATE_ID
    const dupNode = addSystemNode(p, { id: 'gw', name: 'Dup', kind: 'gateway', position: { x: 0, y: 0 } }, NOW);
    expect(dupNode.ok).toBe(false);
    if (!dupNode.ok) expect(dupNode.violations.some((v) => v.code === 'DUPLICATE_ID')).toBe(true);

    // DUPLICATE_BINDING (M:N allows multiple bindings, but unique tuple)
    const dupBind = addBoundaryBinding(
      p,
      { id: 'b-dup', serviceId: 'orders', runtimeConnectionId: 'c-in', adapterUnitId: 'u-http' },
      NOW,
    );
    expect(dupBind.ok).toBe(false);
    if (!dupBind.ok) expect(dupBind.violations.some((v) => v.code === 'DUPLICATE_BINDING')).toBe(true);

    // SELF_LOOP (runtime and static)
    const selfConn = addRuntimeConnection(
      p,
      { id: 'c-self', sourceId: 'orders', targetId: 'orders', kind: 'sync-call', protocol: 'http' },
      NOW,
    );
    expect(selfConn.ok).toBe(false);
    if (!selfConn.ok) expect(selfConn.violations.some((v) => v.code === 'SELF_LOOP')).toBe(true);

    const selfDep = addStaticDependency(
      p,
      { serviceId: 'orders', id: 'd-self', sourceId: 'u-uc', targetId: 'u-uc', kind: 'depends-on' },
      NOW,
    );
    expect(selfDep.ok).toBe(false);
    if (!selfDep.ok) expect(selfDep.violations.some((v) => v.code === 'SELF_LOOP')).toBe(true);

    // INVALID_DRILLDOWN_TARGET
    const badDrill = ensureInternalArchitecture(p, { serviceId: 'gw' }, NOW);
    expect(badDrill.ok).toBe(false);
    if (!badDrill.ok) expect(badDrill.violations.some((v) => v.code === 'INVALID_DRILLDOWN_TARGET')).toBe(true);

    // INVALID_COORDINATE
    const badCoord = updateViewNodePositions(
      p,
      { scope: { level: 'system' }, positions: { gw: { x: Number.NaN, y: 0 } } },
      NOW,
    );
    expect(badCoord.ok).toBe(false);
    if (!badCoord.ok) expect(badCoord.violations.some((v) => v.code === 'INVALID_COORDINATE')).toBe(true);

    // VIEW_PARITY_MISMATCH (corrupted project with missing internal view)
    const missingViewProject: ArchitectureProject = {
      ...p,
      views: p.views.filter((v) => v.scope.level === 'system'),
    };
    expect(validateStructuralInvariants(missingViewProject).some((v) => v.code === 'VIEW_PARITY_MISMATCH')).toBe(true);

    // MISSING_REFERENCE (corrupted project with dangling nodePositions key)
    const orphanPosProject: ArchitectureProject = {
      ...p,
      views: p.views.map((v) =>
        v.scope.level === 'system'
          ? { ...v, nodePositions: { ...v.nodePositions, ghost: { x: 1, y: 2 } } }
          : v,
      ),
    };
    expect(validateStructuralInvariants(orphanPosProject).some((v) => v.code === 'MISSING_REFERENCE')).toBe(true);

    // CARDINALITY_EXCEEDED
    const tooManyNodes = Array.from({ length: MAX_TOTAL_NODES + 1 }, (_, i) => ({
      id: `n-${i}`,
      name: `Node ${i}`,
      kind: 'client' as const,
      description: '',
    }));
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of tooManyNodes) positions[n.id] = { x: 0, y: 0 };
    const overLimitProject: ArchitectureProject = {
      ...p,
      topology: { nodes: tooManyNodes, connections: [] },
      internals: {},
      bindings: [],
      views: [{ id: 'v-sys', scope: { level: 'system' }, nodePositions: positions }],
    };
    expect(validateStructuralInvariants(overLimitProject).some((v) => v.code === 'CARDINALITY_EXCEEDED')).toBe(true);
  });

  it('returns MISSING_REFERENCE when commands target nonexistent entities and handles idempotent/edge cases', () => {
    const p = buildOrdersProject();

    expect(updateSystemNode(p, { id: 'nope', name: 'X' }, NOW).ok).toBe(false);
    expect(changeSystemNodeKind(p, { id: 'nope', kind: 'service' }, NOW).ok).toBe(false);
    expect(changeSystemNodeKind(p, { id: 'orders', kind: 'service' }, NOW).ok).toBe(true);
    expect(changeSystemNodeKind(p, { id: 'gw', kind: 'service' }, NOW).ok).toBe(true);
    expect(clearInternalArchitectureAndChangeKind(p, { id: 'nope', kind: 'gateway' }, NOW).ok).toBe(false);
    expect(deleteSystemNode(p, { id: 'nope' }, NOW).ok).toBe(false);
    expect(updateRuntimeConnection(p, { id: 'nope', protocol: 'http' }, NOW).ok).toBe(false);
    expect(reconnectRuntimeConnection(p, { id: 'nope', targetId: 'pg' }, NOW).ok).toBe(false);
    expect(deleteRuntimeConnection(p, { id: 'nope' }, NOW).ok).toBe(false);
    expect(ensureInternalArchitecture(p, { serviceId: 'nope' }, NOW).ok).toBe(false);
    // Idempotent ensureInternalArchitecture when already initialized
    expect(ensureInternalArchitecture(p, { serviceId: 'orders' }, NOW).ok).toBe(true);
    expect(addCodeUnit(p, { serviceId: 'nope', name: 'U', kind: 'use-case', position: { x: 0, y: 0 } }, NOW).ok).toBe(false);
    expect(updateCodeUnit(p, { serviceId: 'nope', id: 'u-uc', name: 'X' }, NOW).ok).toBe(false);
    expect(updateCodeUnit(p, { serviceId: 'orders', id: 'nope', name: 'X' }, NOW).ok).toBe(false);
    expect(deleteCodeUnit(p, { serviceId: 'nope', id: 'u-uc' }, NOW).ok).toBe(false);
    expect(deleteCodeUnit(p, { serviceId: 'orders', id: 'nope' }, NOW).ok).toBe(false);
    expect(addStaticDependency(p, { serviceId: 'nope', sourceId: 'a', targetId: 'b', kind: 'depends-on' }, NOW).ok).toBe(false);
    expect(updateStaticDependency(p, { serviceId: 'nope', id: 'd-1', label: 'x' }, NOW).ok).toBe(false);
    expect(updateStaticDependency(p, { serviceId: 'orders', id: 'nope', label: 'x' }, NOW).ok).toBe(false);
    expect(updateStaticDependency(p, { serviceId: 'orders', id: 'd-1', label: null }, NOW).ok).toBe(true);
    expect(deleteStaticDependency(p, { serviceId: 'nope', id: 'd-1' }, NOW).ok).toBe(false);
    expect(deleteStaticDependency(p, { serviceId: 'orders', id: 'nope' }, NOW).ok).toBe(false);
    expect(deleteBoundaryBinding(p, { id: 'nope' }, NOW).ok).toBe(false);
    expect(
      updateViewNodePositions(p, { scope: { level: 'internal', serviceId: 'nope' }, positions: {} }, NOW).ok,
    ).toBe(false);

    // Projection edge cases
    expect(deriveBindingDirection(p, { serviceId: 'orders', runtimeConnectionId: 'nope' })).toBeNull();
    expect(deriveBindingDirection(p, { serviceId: 'redis', runtimeConnectionId: 'c-in' })).toBeNull();

    // Multiple outbound connections sort deterministically by runtimeConnectionId
    const withSecondOut = unwrap(
      addRuntimeConnection(
        p,
        { id: 'c-aa', sourceId: 'orders', targetId: 'redis', kind: 'cache-access', protocol: 'redis' },
        NOW,
      ),
    );
    const endpoints = deriveProjectedEndpoints(withSecondOut, 'orders');
    expect(endpoints.map((e) => `${e.direction}:${e.runtimeConnectionId}`)).toEqual([
      'inbound:c-in',
      'outbound:c-aa',
      'outbound:c-db',
    ]);
  });

  it('catches corrupted referential integrity, view parity and all cardinality bounds in validateStructuralInvariants', () => {
    const p = buildOrdersProject();

    // Corrupted connections, internals, static deps, bindings, views
    const corrupted: ArchitectureProject = {
      ...p,
      topology: {
        nodes: p.topology.nodes,
        connections: [
          ...p.topology.connections,
          { id: 'c-bad', sourceId: 'missing-src', targetId: 'missing-tgt', kind: 'sync-call', protocol: 'http' },
        ],
      },
      internals: {
        ...p.internals,
        gw: { serviceId: 'wrong-key', units: [], dependencies: [] },
        ghostSvc: {
          serviceId: 'ghostSvc',
          units: [],
          dependencies: [{ id: 'd-bad', sourceId: 'x', targetId: 'y', kind: 'depends-on' }],
        },
      },
      bindings: [
        ...p.bindings,
        { id: 'b-bad-svc', serviceId: 'no-svc', runtimeConnectionId: 'no-conn', adapterUnitId: 'no-unit' },
        { id: 'b-bad-unit', serviceId: 'orders', runtimeConnectionId: 'c-in', adapterUnitId: 'missing-unit' },
        { id: 'b-non-incident', serviceId: 'gw', runtimeConnectionId: 'c-db', adapterUnitId: 'missing-unit' },
      ],
      views: [
        ...p.views,
        { id: 'v-dup-int', scope: { level: 'internal', serviceId: 'orders' }, nodePositions: {} },
        { id: 'v-orphan-int', scope: { level: 'internal', serviceId: 'no-such-svc' }, nodePositions: {} },
        { id: 'v-dup-sys', scope: { level: 'system' }, nodePositions: {} },
      ],
    };

    const violations = validateStructuralInvariants(corrupted);
    const codes = new Set(violations.map((v) => v.code));
    expect(codes.has('MISSING_REFERENCE')).toBe(true);
    expect(codes.has('INVALID_DRILLDOWN_TARGET')).toBe(true);
    expect(codes.has('VIEW_PARITY_MISMATCH')).toBe(true);
    expect(codes.has('INVALID_COORDINATE')).toBe(true);
  });
});
