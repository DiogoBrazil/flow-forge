import type { CodeLayer, CodeUnitKind } from './types';

export const MAX_TOTAL_NODES = 1_000;
export const MAX_TOTAL_EDGES = 3_000;
export const MAX_BINDINGS = 3_000;
export const MAX_SERVICES = 200;
export const MAX_VIEWS = 201;

export const DEFAULT_LAYER_BY_UNIT_KIND: Readonly<Record<CodeUnitKind, CodeLayer>> = {
  'inbound-adapter': 'adapters',
  'outbound-adapter': 'adapters',
  'use-case': 'application',
  'domain-service': 'domain',
  'domain-entity': 'domain',
  interface: 'application',
};
