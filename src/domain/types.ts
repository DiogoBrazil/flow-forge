export type EntityId = string;

export type RuleProfileId = 'hexagonal' | 'layered' | 'distributed-baseline';

export type SystemNodeKind =
  | 'client'
  | 'gateway'
  | 'service'
  | 'database'
  | 'cache'
  | 'broker'
  | 'external-system';

export type RuntimeConnectionKind =
  | 'sync-call'
  | 'async-publish'
  | 'async-consume'
  | 'data-access'
  | 'cache-access';

export type RuntimeProtocol = 'http' | 'grpc' | 'sql' | 'redis' | 'amqp' | 'kafka' | 'custom';

export type CodeUnitKind =
  | 'inbound-adapter'
  | 'outbound-adapter'
  | 'use-case'
  | 'domain-service'
  | 'domain-entity'
  | 'interface';

export type CodeLayer = 'adapters' | 'application' | 'domain';

export type StaticDependencyKind = 'depends-on' | 'implements';

export interface ArchitectureProject {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly ruleProfile: RuleProfileId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly topology: DistributedTopology;
  readonly internals: Record<EntityId, InternalArchitecture>;
  readonly bindings: readonly BoundaryBinding[];
  readonly views: readonly ArchitectureView[];
}

export interface DistributedTopology {
  readonly nodes: readonly SystemNode[];
  readonly connections: readonly RuntimeConnection[];
}

export interface SystemNode {
  readonly id: EntityId;
  readonly name: string;
  readonly kind: SystemNodeKind;
  readonly description: string;
  readonly technology?: string;
}

export interface RuntimeConnection {
  readonly id: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: RuntimeConnectionKind;
  readonly protocol: RuntimeProtocol;
  readonly label?: string;
}

export interface InternalArchitecture {
  readonly serviceId: EntityId;
  readonly units: readonly CodeUnit[];
  readonly dependencies: readonly StaticDependency[];
}

export interface CodeUnit {
  readonly id: EntityId;
  readonly name: string;
  readonly kind: CodeUnitKind;
  readonly layer: CodeLayer;
  readonly description: string;
}

export interface StaticDependency {
  readonly id: EntityId;
  readonly sourceId: EntityId;
  readonly targetId: EntityId;
  readonly kind: StaticDependencyKind;
  readonly label?: string;
}

export interface BoundaryBinding {
  readonly id: EntityId;
  readonly serviceId: EntityId;
  readonly runtimeConnectionId: EntityId;
  readonly adapterUnitId: EntityId;
}

export interface ProjectedEndpoint {
  readonly runtimeConnectionId: EntityId;
  readonly serviceId: EntityId;
  readonly direction: 'inbound' | 'outbound';
  readonly peerNodeId: EntityId;
  readonly peerNodeName: string;
  readonly connectionKind: RuntimeConnectionKind;
  readonly protocol: RuntimeProtocol;
  readonly label?: string;
}

export type ViewScope =
  | { readonly level: 'system' }
  | { readonly level: 'internal'; readonly serviceId: EntityId };

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface ArchitectureView {
  readonly id: EntityId;
  readonly scope: ViewScope;
  readonly nodePositions: Record<EntityId, Point2D>;
}

export type StructuralViolationCode =
  | 'DUPLICATE_ID'
  | 'DUPLICATE_BINDING'
  | 'SELF_LOOP'
  | 'MISSING_REFERENCE'
  | 'INVALID_DRILLDOWN_TARGET'
  | 'VIEW_PARITY_MISMATCH'
  | 'INVALID_COORDINATE'
  | 'CARDINALITY_EXCEEDED'
  | 'NON_EMPTY_INTERNAL_ARCHITECTURE';

export interface StructuralViolation {
  readonly code: StructuralViolationCode;
  readonly message: string;
  readonly entityId?: EntityId;
}

export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly violations: readonly StructuralViolation[] };
