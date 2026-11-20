import hexagonalOrdersValid from './hexagonalOrdersValid.json';
import hexagonalOrdersDefective from './hexagonalOrdersDefective.json';
import realSystemApiPortsAdapters from './realSystemApiPortsAdapters.json';
import realSystemDistributedCommerce from './realSystemDistributedCommerce.json';

export interface BuiltinExampleMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rawPayload: unknown;
}

export const BUILTIN_EXAMPLES: readonly BuiltinExampleMeta[] = [
  {
    id: 'hexagonal-orders-valid',
    title: 'Pedidos Hexagonal (Válido)',
    description:
      'Topologia distribuída com Orders API em Ports & Adapters e Boundary Binding completo (zero diagnósticos).',
    rawPayload: hexagonalOrdersValid,
  },
  {
    id: 'hexagonal-orders-defective',
    title: 'Pedidos Hexagonal (Com Defeitos)',
    description:
      'Modelo com defeitos arquiteturais intencionais acionando todas as 9 regras determinísticas.',
    rawPayload: hexagonalOrdersDefective,
  },
  {
    id: 'real-system-api-ports-adapters',
    title: 'Sistema Real 1 — API de Faturamento (Ports & Adapters)',
    description:
      'API corporativa anonimizada em Ports & Adapters (casos de uso, interfaces e adaptadores de borda).',
    rawPayload: realSystemApiPortsAdapters,
  },
  {
    id: 'real-system-distributed-commerce',
    title: 'Sistema Real 2 — E-Commerce Distribuído',
    description:
      'Sistema distribuído anonimizado com serviços, PostgreSQL, Redis, Kafka, PSP externo e Boundary Binding completo.',
    rawPayload: realSystemDistributedCommerce,
  },
];
