import { describe, expect, it } from 'vitest';
import { validateStructuralInvariants } from '@domain/invariants';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_IMPORT_FILE_BYTES,
  parseProjectFileDtoV1,
  serializeProjectFileDeterministically,
} from '@schemas/projectFileV1';
import type { ProjectFileDtoV1 } from '@schemas/projectFileV1';

function createValidDto(): ProjectFileDtoV1 {
  return {
    schemaVersion: 1,
    exportedAt: '2026-11-20T12:00:00.000Z',
    project: {
      id: 'proj-orders',
      name: 'Orders MVP',
      description: 'Valid test project',
      ruleProfile: 'hexagonal',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T12:00:00.000Z',
      topology: {
        nodes: [
          { id: 'svc-orders', name: 'Orders API', kind: 'service', description: '', technology: 'Node' },
          { id: 'db-pg', name: 'PostgreSQL', kind: 'database', description: '' },
        ],
        connections: [
          {
            id: 'conn-1',
            sourceId: 'svc-orders',
            targetId: 'db-pg',
            kind: 'data-access',
            protocol: 'sql',
            label: 'Orders table',
          },
        ],
      },
      internals: {
        'svc-orders': {
          serviceId: 'svc-orders',
          units: [
            { id: 'u-repo', name: 'OrderRepo', kind: 'interface', layer: 'application', description: '' },
            { id: 'u-pg', name: 'PgAdapter', kind: 'outbound-adapter', layer: 'adapters', description: '' },
          ],
          dependencies: [
            { id: 'dep-1', sourceId: 'u-pg', targetId: 'u-repo', kind: 'implements' },
          ],
        },
      },
      bindings: [
        { id: 'bind-1', serviceId: 'svc-orders', runtimeConnectionId: 'conn-1', adapterUnitId: 'u-pg' },
      ],
      views: [
        {
          id: 'view-sys',
          scope: { level: 'system' },
          nodePositions: {
            'svc-orders': { x: 100, y: 200 },
            'db-pg': { x: 400, y: 200 },
          },
        },
        {
          id: 'view-int-orders',
          scope: { level: 'internal', serviceId: 'svc-orders' },
          nodePositions: {
            'u-repo': { x: 300, y: 100 },
            'u-pg': { x: 100, y: 100 },
          },
        },
      ],
    },
  };
}

describe('ProjectFileDtoV1 schema, security & deterministic serialization', () => {
  it('exports normative constants', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(MAX_IMPORT_FILE_BYTES).toBe(5_242_880);
  });

  it('performs lossless round-trip and passes structural invariants', () => {
    const dto = createValidDto();
    const json = serializeProjectFileDeterministically(dto);
    const parsed = parseProjectFileDtoV1(JSON.parse(json));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.schemaVersion).toBe(1);
      expect(validateStructuralInvariants(parsed.value.project)).toEqual([]);
      expect(serializeProjectFileDeterministically(parsed.value)).toBe(json);
    }
  });

  it('produces identical deterministic JSON regardless of array and key insertion order', () => {
    const dtoA = createValidDto();
    const dtoB: ProjectFileDtoV1 = {
      ...dtoA,
      project: {
        ...dtoA.project,
        topology: {
          ...dtoA.project.topology,
          nodes: [...dtoA.project.topology.nodes].reverse(),
        },
        views: [...dtoA.project.views].reverse().map((v) => {
          const reversedPositions: Record<string, { x: number; y: number }> = {};
          for (const key of Object.keys(v.nodePositions).reverse()) {
            reversedPositions[key] = v.nodePositions[key]!;
          }
          return { ...v, nodePositions: reversedPositions };
        }),
      },
    };

    expect(serializeProjectFileDeterministically(dtoA)).toBe(
      serializeProjectFileDeterministically(dtoB),
    );
  });

  it('rejects future schema versions and invalid schemaVersion values', () => {
    const base = createValidDto();

    for (const futureVersion of [2, 99]) {
      const res = parseProjectFileDtoV1({ ...base, schemaVersion: futureVersion });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('UNSUPPORTED_FUTURE_VERSION');
    }

    for (const invalid of [0, -1, 1.5, '1', null, undefined]) {
      const res = parseProjectFileDtoV1({ ...base, schemaVersion: invalid });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('INVALID_SCHEMA_VERSION');
    }

    const notObj = parseProjectFileDtoV1(['not-an-object']);
    expect(notObj.ok).toBe(false);
    if (!notObj.ok) expect(notObj.code).toBe('INVALID_SCHEMA_VERSION');
  });

  it('rejects unknown extra fields (z.strictObject) and explicit undefined on exactOptional fields', () => {
    const base = createValidDto();

    const extraRoot = parseProjectFileDtoV1({ ...base, unexpectedField: true });
    expect(extraRoot.ok).toBe(false);
    if (!extraRoot.ok) expect(extraRoot.code).toBe('SCHEMA_VALIDATION_FAILED');

    const extraNode = parseProjectFileDtoV1({
      ...base,
      project: {
        ...base.project,
        topology: {
          ...base.project.topology,
          nodes: [{ ...base.project.topology.nodes[0]!, hack: 123 }],
        },
      },
    });
    expect(extraNode.ok).toBe(false);

    // Explicit undefined on exactOptional field must fail under Zod v4 .exactOptional()
    const explicitUndefined = parseProjectFileDtoV1({
      ...base,
      exportedAt: undefined,
    });
    expect(explicitUndefined.ok).toBe(false);
  });

  it('blocks reserved prototype-pollution keys (__proto__, constructor, prototype, toString)', () => {
    for (const key of ['__proto__', 'constructor', 'prototype', 'toString']) {
      // As EntityId value
      const badId = createValidDto();
      const resId = parseProjectFileDtoV1({
        ...badId,
        project: { ...badId.project, id: key },
      });
      expect(resId.ok).toBe(false);

      // As raw JSON object key (JSON.parse preserves "__proto__" as own property)
      const rawJson = `{"schemaVersion":1,"project":{"id":"p1","name":"P","description":"","ruleProfile":"hexagonal","createdAt":"2026-01-01","updatedAt":"2026-01-01","topology":{"nodes":[],"connections":[]},"internals":{},"bindings":[],"views":[{"id":"v1","scope":{"level":"system"},"nodePositions":{"${key}":{"x":0,"y":0}}}]}}`;
      const resKey = parseProjectFileDtoV1(JSON.parse(rawJson));
      expect(resKey.ok).toBe(false);
      if (!resKey.ok) expect(resKey.code).toBe('SCHEMA_VALIDATION_FAILED');
    }
  });

  it('enforces string bounds and finite coordinates', () => {
    const base = createValidDto();

    // Blank name after trim
    const blankName = parseProjectFileDtoV1({
      ...base,
      project: { ...base.project, name: '   ' },
    });
    expect(blankName.ok).toBe(false);

    // Name > 120 chars
    const longName = parseProjectFileDtoV1({
      ...base,
      project: { ...base.project, name: 'a'.repeat(121) },
    });
    expect(longName.ok).toBe(false);

    // Description > 4000 chars
    const longDesc = parseProjectFileDtoV1({
      ...base,
      project: { ...base.project, description: 'd'.repeat(4001) },
    });
    expect(longDesc.ok).toBe(false);

    // Technology > 80 chars
    const longTech = parseProjectFileDtoV1({
      ...base,
      project: {
        ...base.project,
        topology: {
          ...base.project.topology,
          nodes: [{ ...base.project.topology.nodes[0]!, technology: 't'.repeat(81) }],
        },
      },
    });
    expect(longTech.ok).toBe(false);

    // Label > 120 chars
    const longLabel = parseProjectFileDtoV1({
      ...base,
      project: {
        ...base.project,
        topology: {
          ...base.project.topology,
          connections: [{ ...base.project.topology.connections[0]!, label: 'l'.repeat(121) }],
        },
      },
    });
    expect(longLabel.ok).toBe(false);

    // NaN / Infinity coordinates
    for (const badNum of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const badCoord = parseProjectFileDtoV1({
        ...base,
        project: {
          ...base.project,
          views: [
            {
              id: 'view-sys',
              scope: { level: 'system' },
              nodePositions: { 'svc-orders': { x: badNum, y: 0 } },
            },
          ],
        },
      });
      expect(badCoord.ok).toBe(false);
    }
  });
});
