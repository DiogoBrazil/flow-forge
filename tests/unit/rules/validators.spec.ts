import { describe, expect, it } from 'vitest';
import {
  addBoundaryBinding,
  addCodeUnit,
  addRuntimeConnection,
  addStaticDependency,
  addSystemNode,
  createEmptyProject,
  ensureInternalArchitecture,
  setRuleProfile,
} from '@domain/commands';
import type {
  ArchitectureProject,
  CodeLayer,
  DomainResult,
  RuleProfileId,
} from '@domain/types';
import { evaluateProject } from '@rules/evaluateProject';
import { isLayerTransitionAllowed } from '@rules/rulesCatalog';
import { findStronglyConnectedCycles } from '@rules/tarjan';

const NOW = '2026-11-20T12:00:00.000Z';

function unwrap(res: DomainResult<ArchitectureProject>): ArchitectureProject {
  if (!res.ok) {
    throw new Error(`Expected ok result, got: ${JSON.stringify(res.violations)}`);
  }
  return res.value;
}

describe('Tarjan SCC cycle detection', () => {
  it('returns deterministic sorted cycles for SCCs of size >= 2 and ignores DAGs', () => {
    expect(
      findStronglyConnectedCycles(
        ['a', 'b', 'c'],
        [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
        ],
      ),
    ).toEqual([]);

    const cycles = findStronglyConnectedCycles(
      ['d', 'c', 'b', 'a', 'e'],
      [
        { source: 'c', target: 'd' },
        { source: 'd', target: 'c' },
        { source: 'b', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'e' },
      ],
    );
    expect(cycles).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('3x3 layer matrix across all rule profiles', () => {
  const layers: readonly CodeLayer[] = ['adapters', 'application', 'domain'];

  it('matches the normative 3x3 matrix for hexagonal, layered and distributed-baseline', () => {
    const expected: Record<RuleProfileId, Record<`${CodeLayer}->${CodeLayer}`, boolean>> = {
      hexagonal: {
        'adapters->adapters': true,
        'adapters->application': true,
        'adapters->domain': true,
        'application->adapters': false,
        'application->application': true,
        'application->domain': true,
        'domain->adapters': false,
        'domain->application': false,
        'domain->domain': true,
      },
      layered: {
        'adapters->adapters': true,
        'adapters->application': true,
        'adapters->domain': false,
        'application->adapters': false,
        'application->application': true,
        'application->domain': true,
        'domain->adapters': false,
        'domain->application': false,
        'domain->domain': true,
      },
      'distributed-baseline': {
        'adapters->adapters': true,
        'adapters->application': true,
        'adapters->domain': true,
        'application->adapters': true,
        'application->application': true,
        'application->domain': true,
        'domain->adapters': true,
        'domain->application': true,
        'domain->domain': true,
      },
    };

    for (const profile of ['hexagonal', 'layered', 'distributed-baseline'] as const) {
      for (const src of layers) {
        for (const tgt of layers) {
          expect(isLayerTransitionAllowed(profile, src, tgt)).toBe(
            expected[profile][`${src}->${tgt}`],
          );
        }
      }
    }
  });
});

describe('All 9 deterministic architectural rules', () => {
  it('evaluates implements edges in both LAYER_VIOLATION and STATIC_DEPENDENCY_CYCLE', () => {
    let p = unwrap(createEmptyProject({ id: 'p1', name: 'P1', systemViewId: 'v-sys' }, NOW));
    p = unwrap(addSystemNode(p, { id: 'svc', name: 'Svc', kind: 'service', position: { x: 0, y: 0 } }, NOW));
    p = unwrap(ensureInternalArchitecture(p, { serviceId: 'svc', viewId: 'v-svc' }, NOW));
    p = unwrap(
      addCodeUnit(
        p,
        { serviceId: 'svc', id: 'dom-if', name: 'DomIf', kind: 'interface', layer: 'domain', position: { x: 0, y: 0 } },
        NOW,
      ),
    );
    p = unwrap(
      addCodeUnit(
        p,
        { serviceId: 'svc', id: 'adp-if', name: 'AdpIf', kind: 'interface', layer: 'adapters', position: { x: 100, y: 0 } },
        NOW,
      ),
    );
    // domain implements adapters -> LAYER_VIOLATION + cycle with adapters -> domain
    p = unwrap(
      addStaticDependency(
        p,
        { serviceId: 'svc', id: 'd1', sourceId: 'dom-if', targetId: 'adp-if', kind: 'implements' },
        NOW,
      ),
    );
    p = unwrap(
      addStaticDependency(
        p,
        { serviceId: 'svc', id: 'd2', sourceId: 'adp-if', targetId: 'dom-if', kind: 'depends-on' },
        NOW,
      ),
    );

    const diags = evaluateProject(p);
    const layerViol = diags.find((d) => d.ruleId === 'LAYER_VIOLATION');
    expect(layerViol).toBeDefined();
    expect(layerViol?.targets.some((t) => t.kind === 'static-dependency' && t.id === 'd1')).toBe(true);
    expect(layerViol?.evidence['dependencyKind']).toBe('implements');

    const cycleViol = diags.find((d) => d.ruleId === 'STATIC_DEPENDENCY_CYCLE');
    expect(cycleViol).toBeDefined();
    expect(cycleViol?.evidence['cycleUnitIds']).toEqual(['adp-if', 'dom-if']);

    // distributed-baseline disables LAYER_VIOLATION and downgrades UNIMPLEMENTED_INTERFACE to warning
    const baseline = unwrap(setRuleProfile(p, { ruleProfile: 'distributed-baseline' }, NOW));
    const baselineDiags = evaluateProject(baseline);
    expect(baselineDiags.some((d) => d.ruleId === 'LAYER_VIOLATION')).toBe(false);
    const unimpl = baselineDiags.find((d) => d.ruleId === 'UNIMPLEMENTED_INTERFACE');
    expect(unimpl?.severity).toBe('warning');
  });

  it('validates all 8 sub-conditions of INCOMPATIBLE_RUNTIME_CONNECTION and async-publish/consume with broker', () => {
    let p = unwrap(createEmptyProject({ id: 'p2', name: 'P2', systemViewId: 'v-sys' }, NOW));
    p = unwrap(addSystemNode(p, { id: 'client', name: 'Web', kind: 'client', position: { x: 0, y: 0 } }, NOW));
    p = unwrap(addSystemNode(p, { id: 'svc', name: 'Orders', kind: 'service', position: { x: 100, y: 0 } }, NOW));
    p = unwrap(addSystemNode(p, { id: 'db', name: 'PG', kind: 'database', position: { x: 200, y: 0 } }, NOW));
    p = unwrap(addSystemNode(p, { id: 'cache', name: 'Redis', kind: 'cache', position: { x: 300, y: 0 } }, NOW));
    p = unwrap(addSystemNode(p, { id: 'broker', name: 'Kafka', kind: 'broker', position: { x: 400, y: 0 } }, NOW));

    // (1) client -> db & client -> cache
    p = unwrap(addRuntimeConnection(p, { id: 'c1', sourceId: 'client', targetId: 'db', kind: 'data-access', protocol: 'sql' }, NOW));
    // (2) db as source
    p = unwrap(addRuntimeConnection(p, { id: 'c2', sourceId: 'db', targetId: 'svc', kind: 'sync-call', protocol: 'custom' }, NOW));
    // (3) data-access to non-database
    p = unwrap(addRuntimeConnection(p, { id: 'c3', sourceId: 'svc', targetId: 'cache', kind: 'data-access', protocol: 'sql' }, NOW));
    // (4) cache-access to non-cache
    p = unwrap(addRuntimeConnection(p, { id: 'c4', sourceId: 'svc', targetId: 'db', kind: 'cache-access', protocol: 'redis' }, NOW));
    // (5) async-publish to non-broker
    p = unwrap(addRuntimeConnection(p, { id: 'c5', sourceId: 'svc', targetId: 'db', kind: 'async-publish', protocol: 'kafka' }, NOW));
    // (6) async-consume from non-broker
    p = unwrap(addRuntimeConnection(p, { id: 'c6', sourceId: 'svc', targetId: 'broker', kind: 'async-consume', protocol: 'kafka' }, NOW));
    // (7) service -> client sync-call (warning)
    p = unwrap(addRuntimeConnection(p, { id: 'c7', sourceId: 'svc', targetId: 'client', kind: 'sync-call', protocol: 'http' }, NOW));
    // (8) protocol mismatch (sql in sync-call)
    p = unwrap(addRuntimeConnection(p, { id: 'c8', sourceId: 'client', targetId: 'svc', kind: 'sync-call', protocol: 'sql' }, NOW));
    // Valid async-publish & async-consume with broker
    p = unwrap(addRuntimeConnection(p, { id: 'c-pub-ok', sourceId: 'svc', targetId: 'broker', kind: 'async-publish', protocol: 'kafka' }, NOW));
    p = unwrap(addRuntimeConnection(p, { id: 'c-con-ok', sourceId: 'broker', targetId: 'svc', kind: 'async-consume', protocol: 'amqp' }, NOW));

    const diags = evaluateProject(p).filter((d) => d.ruleId === 'INCOMPATIBLE_RUNTIME_CONNECTION');
    const reasons = new Set(diags.map((d) => d.evidence['reason']));

    expect(reasons).toEqual(
      new Set([
        'CLIENT_DIRECT_DATA_ACCESS',
        'PASSIVE_STORE_AS_SOURCE',
        'DATA_ACCESS_NON_DATABASE',
        'CACHE_ACCESS_NON_CACHE',
        'ASYNC_PUBLISH_NON_BROKER',
        'ASYNC_CONSUME_NON_BROKER',
        'SERVICE_SYNC_CALL_TO_CLIENT',
        'PROTOCOL_KIND_MISMATCH',
      ]),
    );
    expect(diags.some((d) => d.evidence['connectionId'] === 'c-pub-ok')).toBe(false);
    expect(diags.some((d) => d.evidence['connectionId'] === 'c-con-ok')).toBe(false);
  });

  it('detects BOUNDARY_DIRECTION_MISMATCH for non-adapter unit and reversed direction, and orders errors before warnings', () => {
    let p = unwrap(createEmptyProject({ id: 'p3', name: 'P3', systemViewId: 'v-sys' }, NOW));
    p = unwrap(addSystemNode(p, { id: 'broker', name: 'Kafka', kind: 'broker', position: { x: 0, y: 0 } }, NOW));
    p = unwrap(addSystemNode(p, { id: 'svc', name: 'Consumer', kind: 'service', position: { x: 200, y: 0 } }, NOW));
    p = unwrap(
      addRuntimeConnection(
        p,
        { id: 'c-consume', sourceId: 'broker', targetId: 'svc', kind: 'async-consume', protocol: 'kafka' },
        NOW,
      ),
    );
    p = unwrap(ensureInternalArchitecture(p, { serviceId: 'svc', viewId: 'v-svc' }, NOW));
    p = unwrap(
      addCodeUnit(
        p,
        { serviceId: 'svc', id: 'u-in', name: 'KafkaConsumerAdapter', kind: 'inbound-adapter', position: { x: 0, y: 0 } },
        NOW,
      ),
    );
    p = unwrap(
      addCodeUnit(
        p,
        { serviceId: 'svc', id: 'u-uc', name: 'HandleEvent', kind: 'use-case', position: { x: 200, y: 0 } },
        NOW,
      ),
    );
    // Valid binding: broker -> svc (inbound) bound to inbound-adapter
    p = unwrap(
      addBoundaryBinding(
        p,
        { id: 'b-ok', serviceId: 'svc', runtimeConnectionId: 'c-consume', adapterUnitId: 'u-in' },
        NOW,
      ),
    );
    expect(evaluateProject(p)).toEqual([]);

    // Invalid binding: non-adapter use-case bound to external endpoint
    p = unwrap(
      addBoundaryBinding(
        p,
        { id: 'b-bad', serviceId: 'svc', runtimeConnectionId: 'c-consume', adapterUnitId: 'u-uc' },
        NOW,
      ),
    );
    const diags = evaluateProject(p);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.ruleId).toBe('BOUNDARY_DIRECTION_MISMATCH');
    expect(diags[0]?.severity).toBe('error');
    expect(diags[0]?.targets.some((t) => t.kind === 'boundary-binding' && t.id === 'b-bad')).toBe(true);
  });

  it('meets the < 50 ms performance budget on a synthetic model of 200 nodes and 500 edges', () => {
    let p = unwrap(createEmptyProject({ id: 'perf', name: 'Perf 200x500', systemViewId: 'v-sys' }, NOW));

    // 100 system nodes (including 10 services) + 250 runtime connections
    for (let i = 0; i < 100; i++) {
      const kind = i < 10 ? 'service' : i % 3 === 0 ? 'database' : i % 3 === 1 ? 'broker' : 'gateway';
      p = unwrap(
        addSystemNode(p, { id: `sn-${i}`, name: `Node ${i}`, kind, position: { x: i * 10, y: 0 } }, NOW),
      );
    }
    for (let i = 0; i < 250; i++) {
      const src = `sn-${i % 10}`;
      const tgt = `sn-${10 + (i % 90)}`;
      p = unwrap(
        addRuntimeConnection(
          p,
          { id: `rc-${i}`, sourceId: src, targetId: tgt, kind: 'sync-call', protocol: 'http' },
          NOW,
        ),
      );
    }

    // 10 services × 10 code units = 100 internal nodes + 250 static dependencies
    let depIdx = 0;
    for (let s = 0; s < 10; s++) {
      const sid = `sn-${s}`;
      p = unwrap(ensureInternalArchitecture(p, { serviceId: sid, viewId: `v-${sid}` }, NOW));
      for (let u = 0; u < 10; u++) {
        const kind = u === 0 ? 'inbound-adapter' : u < 5 ? 'use-case' : u < 8 ? 'interface' : 'outbound-adapter';
        p = unwrap(
          addCodeUnit(
            p,
            { serviceId: sid, id: `u-${s}-${u}`, name: `Unit ${s}-${u}`, kind, position: { x: u * 20, y: 0 } },
            NOW,
          ),
        );
      }
      for (let e = 0; e < 25; e++) {
        const src = `u-${s}-${e % 10}`;
        const tgt = `u-${s}-${(e + 1 + Math.floor(e / 10)) % 10}`;
        if (src === tgt) continue;
        p = unwrap(
          addStaticDependency(
            p,
            { serviceId: sid, id: `sd-${depIdx++}`, sourceId: src, targetId: tgt, kind: 'depends-on' },
            NOW,
          ),
        );
      }
    }

    const start = performance.now();
    const diags = evaluateProject(p);
    const elapsedMs = performance.now() - start;

    expect(diags.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(50);
  });
});
