import { describe, expect, it } from 'vitest';
import { createProjectFromExample } from '@application/use-cases/projectLifecycle';
import { createWorkspaceSession } from '@application/use-cases/sessionState';
import { validateStructuralInvariants } from '@domain/invariants';
import { BUILTIN_EXAMPLES } from '@examples/index';
import { evaluateProject } from '@rules/evaluateProject';
import { parseProjectFileDtoV1 } from '@schemas/projectFileV1';
import { InMemoryProjectRepository } from '../../fakes/InMemoryProjectRepository';

const ALL_NINE_RULE_IDS = [
  'BOUNDARY_DIRECTION_MISMATCH',
  'DISTRIBUTED_DEPENDENCY_CYCLE',
  'INCOMPATIBLE_RUNTIME_CONNECTION',
  'INVALID_IMPLEMENTS_TARGET',
  'LAYER_VIOLATION',
  'STATIC_DEPENDENCY_CYCLE',
  'UNBOUND_ADAPTER',
  'UNBOUND_EXTERNAL_ENDPOINT',
  'UNIMPLEMENTED_INTERFACE',
] as const;

describe('Built-in examples integrity & deterministic validation', () => {
  it('parses all built-in examples with schema v1 and zero structural invariant violations', () => {
    expect(BUILTIN_EXAMPLES.length).toBeGreaterThanOrEqual(2);

    for (const example of BUILTIN_EXAMPLES) {
      const parsed = parseProjectFileDtoV1(example.rawPayload);
      expect(parsed.ok, `Example "${example.id}" failed schema validation`).toBe(true);
      if (parsed.ok) {
        expect(
          validateStructuralInvariants(parsed.value.project),
          `Example "${example.id}" failed structural invariants`,
        ).toEqual([]);
      }
    }
  });

  it('produces zero diagnostics for hexagonalOrdersValid', () => {
    const valid = BUILTIN_EXAMPLES.find((e) => e.id === 'hexagonal-orders-valid');
    expect(valid).toBeDefined();
    const parsed = parseProjectFileDtoV1(valid!.rawPayload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(evaluateProject(parsed.value.project)).toEqual([]);
    }
  });

  it('triggers all 9 deterministic rules in hexagonalOrdersDefective and orders errors before warnings', () => {
    const defective = BUILTIN_EXAMPLES.find((e) => e.id === 'hexagonal-orders-defective');
    expect(defective).toBeDefined();
    const parsed = parseProjectFileDtoV1(defective!.rawPayload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const diags = evaluateProject(parsed.value.project);
      const triggeredRules = [...new Set(diags.map((d) => d.ruleId))].sort();
      expect(triggeredRules).toEqual([...ALL_NINE_RULE_IDS]);

      // Verify severity ordering (all errors before all warnings)
      const firstWarningIdx = diags.findIndex((d) => d.severity === 'warning');
      const lastErrorIdx = diags.map((d) => d.severity).lastIndexOf('error');
      expect(lastErrorIdx).toBeLessThan(firstWarningIdx);
    }
  });

  it('imports all built-in examples cleanly via createProjectFromExample use case', async () => {
    const repo = new InMemoryProjectRepository();
    const session = createWorkspaceSession();

    for (const example of BUILTIN_EXAMPLES) {
      const res = await createProjectFromExample({ projectRepo: repo, session }, example.id);
      expect(res.ok, `createProjectFromExample("${example.id}") failed`).toBe(true);
    }
  });
});
