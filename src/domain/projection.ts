import type {
  ArchitectureProject,
  BoundaryBinding,
  EntityId,
  ProjectedEndpoint,
} from './types';

export function deriveBindingDirection(
  project: ArchitectureProject,
  binding: Pick<BoundaryBinding, 'serviceId' | 'runtimeConnectionId'>,
): 'inbound' | 'outbound' | null {
  const connection = project.topology.connections.find(
    (c) => c.id === binding.runtimeConnectionId,
  );
  if (!connection) {
    return null;
  }
  if (connection.targetId === binding.serviceId) {
    return 'inbound';
  }
  if (connection.sourceId === binding.serviceId) {
    return 'outbound';
  }
  return null;
}

export function deriveProjectedEndpoints(
  project: ArchitectureProject,
  serviceId: EntityId,
): readonly ProjectedEndpoint[] {
  const nodesById = new Map(project.topology.nodes.map((node) => [node.id, node]));
  const endpoints: ProjectedEndpoint[] = [];

  for (const conn of project.topology.connections) {
    if (conn.targetId === serviceId) {
      const peer = nodesById.get(conn.sourceId);
      if (!peer) continue;
      const endpoint: ProjectedEndpoint = {
        runtimeConnectionId: conn.id,
        serviceId,
        direction: 'inbound',
        peerNodeId: peer.id,
        peerNodeName: peer.name,
        connectionKind: conn.kind,
        protocol: conn.protocol,
        ...(conn.label !== undefined ? { label: conn.label } : {}),
      };
      endpoints.push(endpoint);
    } else if (conn.sourceId === serviceId) {
      const peer = nodesById.get(conn.targetId);
      if (!peer) continue;
      const endpoint: ProjectedEndpoint = {
        runtimeConnectionId: conn.id,
        serviceId,
        direction: 'outbound',
        peerNodeId: peer.id,
        peerNodeName: peer.name,
        connectionKind: conn.kind,
        protocol: conn.protocol,
        ...(conn.label !== undefined ? { label: conn.label } : {}),
      };
      endpoints.push(endpoint);
    }
  }

  endpoints.sort((a, b) => {
    if (a.direction !== b.direction) {
      return a.direction < b.direction ? -1 : 1;
    }
    return a.runtimeConnectionId < b.runtimeConnectionId
      ? -1
      : a.runtimeConnectionId > b.runtimeConnectionId
        ? 1
        : 0;
  });

  return endpoints;
}
