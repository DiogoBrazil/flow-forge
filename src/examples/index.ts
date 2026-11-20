import hexagonalOrdersValid from './hexagonalOrdersValid.json';
import hexagonalOrdersDefective from './hexagonalOrdersDefective.json';

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
];
