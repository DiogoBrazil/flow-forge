import type { ArchitectureProject } from '@domain/types';
import { ALL_ARCHITECTURE_RULES } from './rulesCatalog';
import type { ArchitectureRule, Diagnostic } from './types';

function compareLex(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function evaluateProject(
  project: ArchitectureProject,
  rules: readonly ArchitectureRule[] = ALL_ARCHITECTURE_RULES,
): readonly Diagnostic[] {
  const results: Diagnostic[] = [];
  for (const rule of rules) {
    const diagnostics = rule(project);
    for (const d of diagnostics) {
      results.push(d);
    }
  }

  results.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    const ruleCmp = compareLex(a.ruleId, b.ruleId);
    if (ruleCmp !== 0) return ruleCmp;
    return compareLex(a.id, b.id);
  });

  return results;
}
