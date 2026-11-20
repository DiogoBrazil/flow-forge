export interface DirectedEdge {
  readonly source: string;
  readonly target: string;
}

/**
 * Iterative/standard Tarjan Strongly Connected Components algorithm O(V + E).
 * Returns all cycles (SCCs with >= 2 vertices) in deterministic lexicographic order.
 */
export function findStronglyConnectedCycles(
  nodeIds: readonly string[],
  edges: readonly DirectedEdge[],
): readonly (readonly string[])[] {
  const sortedNodes = [...nodeIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const adjacency = new Map<string, string[]>();
  for (const id of sortedNodes) {
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    const list = adjacency.get(edge.source);
    if (list && adjacency.has(edge.target)) {
      list.push(edge.target);
    }
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, nextIndex);
    lowlink.set(v, nextIndex);
    nextIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjacency.get(v) ?? [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        const lowV = lowlink.get(v) ?? 0;
        const lowW = lowlink.get(w) ?? 0;
        if (lowW < lowV) {
          lowlink.set(v, lowW);
        }
      } else if (onStack.has(w)) {
        const lowV = lowlink.get(v) ?? 0;
        const idxW = indices.get(w) ?? 0;
        if (idxW < lowV) {
          lowlink.set(v, idxW);
        }
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string | undefined;
      do {
        w = stack.pop();
        if (w !== undefined) {
          onStack.delete(w);
          component.push(w);
        }
      } while (w !== undefined && w !== v);

      if (component.length >= 2) {
        component.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        cycles.push(component);
      }
    }
  }

  for (const nodeId of sortedNodes) {
    if (!indices.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  cycles.sort((a, b) => {
    const firstA = a[0] ?? '';
    const firstB = b[0] ?? '';
    return firstA < firstB ? -1 : firstA > firstB ? 1 : 0;
  });

  return cycles;
}
