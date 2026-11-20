<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ArrowLeftRight,
  FolderOpen,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next';
import type { ArchitectureCommand } from '@application/use-cases/editArchitecture';
import { deriveProjectedEndpoints } from '@domain/projection';
import type {
  ArchitectureProject,
  CodeLayer,
  CodeUnit,
  CodeUnitKind,
  EntityId,
  RuntimeConnection,
  RuntimeConnectionKind,
  RuntimeProtocol,
  StaticDependency,
  StaticDependencyKind,
  SystemNode,
  SystemNodeKind,
  ViewScope,
} from '@domain/types';
import { inferConnectionDefaults } from '../composables/useWorkspace';
import type { SelectedElement } from '../composables/useWorkspace';
import AppDialog from './AppDialog.vue';

const props = defineProps<{
  project: ArchitectureProject;
  activeScope: ViewScope;
  selectedElement: SelectedElement;
}>();

const emit = defineEmits<{
  edit: [command: ArchitectureCommand];
  drillDown: [serviceId: EntityId];
  clearSelection: [];
}>();

const selectedSystemNode = computed<SystemNode | null>(() => {
  if (props.selectedElement?.kind !== 'system-node') return null;
  return props.project.topology.nodes.find((n) => n.id === props.selectedElement?.id) ?? null;
});

const otherSystemNodes = computed(() => {
  if (!selectedSystemNode.value) return [];
  return props.project.topology.nodes.filter((n) => n.id !== selectedSystemNode.value?.id);
});

const selectedConnection = computed<RuntimeConnection | null>(() => {
  if (props.selectedElement?.kind !== 'runtime-connection') return null;
  return props.project.topology.connections.find((c) => c.id === props.selectedElement?.id) ?? null;
});

const activeInternal = computed(() => {
  if (props.activeScope.level !== 'internal') return null;
  const sid = props.activeScope.serviceId;
  return Object.hasOwn(props.project.internals, sid) ? (props.project.internals[sid] ?? null) : null;
});

const selectedCodeUnit = computed<CodeUnit | null>(() => {
  if (props.selectedElement?.kind !== 'code-unit' || !activeInternal.value) return null;
  return activeInternal.value.units.find((u) => u.id === props.selectedElement?.id) ?? null;
});

const otherCodeUnits = computed(() => {
  if (!selectedCodeUnit.value || !activeInternal.value) return [];
  return activeInternal.value.units.filter((u) => u.id !== selectedCodeUnit.value?.id);
});

const selectedStaticDep = computed<StaticDependency | null>(() => {
  if (props.selectedElement?.kind !== 'static-dependency' || !activeInternal.value) return null;
  return activeInternal.value.dependencies.find((d) => d.id === props.selectedElement?.id) ?? null;
});

const projectedEndpoints = computed(() => {
  if (props.activeScope.level !== 'internal') return [];
  return deriveProjectedEndpoints(props.project, props.activeScope.serviceId);
});

const adapterUnits = computed(() => {
  if (!activeInternal.value) return [];
  return activeInternal.value.units.filter(
    (u) => u.kind === 'inbound-adapter' || u.kind === 'outbound-adapter',
  );
});

const bindingSelections = ref<Record<EntityId, EntityId>>({});
const quickConnectTargetId = ref<EntityId>('');
const quickDepTargetId = ref<EntityId>('');
const quickDepKind = ref<StaticDependencyKind>('depends-on');
const pendingKindChange = ref<{ node: SystemNode; nextKind: SystemNodeKind; unitCount: number } | null>(
  null,
);

function bindingsForConnection(runtimeConnectionId: EntityId) {
  if (props.activeScope.level !== 'internal') return [];
  const sid = props.activeScope.serviceId;
  return props.project.bindings.filter(
    (b) => b.serviceId === sid && b.runtimeConnectionId === runtimeConnectionId,
  );
}

function unitNameById(unitId: EntityId): string {
  return activeInternal.value?.units.find((u) => u.id === unitId)?.name ?? unitId;
}

function handleChangeSystemNodeKind(node: SystemNode, nextKind: SystemNodeKind): void {
  if (node.kind === 'service' && nextKind !== 'service') {
    const internal = Object.hasOwn(props.project.internals, node.id)
      ? props.project.internals[node.id]
      : undefined;
    if (internal && internal.units.length > 0) {
      pendingKindChange.value = { node, nextKind, unitCount: internal.units.length };
      return;
    }
  }
  emit('edit', { type: 'changeSystemNodeKind', payload: { id: node.id, kind: nextKind } });
}

function confirmKindChange(): void {
  if (!pendingKindChange.value) return;
  const { node, nextKind } = pendingKindChange.value;
  pendingKindChange.value = null;
  emit('edit', {
    type: 'clearInternalArchitectureAndChangeKind',
    payload: { id: node.id, kind: nextKind },
  });
}

function handleQuickConnect(): void {
  const source = selectedSystemNode.value;
  const targetId = quickConnectTargetId.value;
  if (!source || !targetId) return;
  const target = props.project.topology.nodes.find((n) => n.id === targetId);
  const defaults = inferConnectionDefaults(source.kind, target?.kind);
  emit('edit', {
    type: 'addRuntimeConnection',
    payload: {
      sourceId: source.id,
      targetId,
      kind: defaults.kind,
      protocol: defaults.protocol,
    },
  });
  quickConnectTargetId.value = '';
}

function handleQuickAddDependency(): void {
  if (props.activeScope.level !== 'internal' || !selectedCodeUnit.value || !quickDepTargetId.value) {
    return;
  }
  emit('edit', {
    type: 'addStaticDependency',
    payload: {
      serviceId: props.activeScope.serviceId,
      sourceId: selectedCodeUnit.value.id,
      targetId: quickDepTargetId.value,
      kind: quickDepKind.value,
    },
  });
  quickDepTargetId.value = '';
}

function handleBindEndpoint(runtimeConnectionId: EntityId): void {
  if (props.activeScope.level !== 'internal') return;
  const adapterUnitId = bindingSelections.value[runtimeConnectionId];
  if (!adapterUnitId) return;
  emit('edit', {
    type: 'addBoundaryBinding',
    payload: {
      serviceId: props.activeScope.serviceId,
      runtimeConnectionId,
      adapterUnitId,
    },
  });
  bindingSelections.value[runtimeConnectionId] = '';
}
</script>

<template>
  <aside class="ff-inspector" aria-label="Painel Inspetor" data-testid="inspector-panel">
    <!-- Selected SystemNode -->
    <section v-if="selectedSystemNode" class="ff-inspector__section">
      <h4>Nó da Topologia</h4>
      <label class="ff-field">
        <span>Nome</span>
        <input
          :value="selectedSystemNode.name"
          data-testid="inspector-node-name"
          @change="
            emit('edit', {
              type: 'updateSystemNode',
              payload: { id: selectedSystemNode.id, name: ($event.target as HTMLInputElement).value },
            })
          "
        />
      </label>
      <label class="ff-field">
        <span>Tipo</span>
        <select
          :value="selectedSystemNode.kind"
          @change="
            handleChangeSystemNodeKind(
              selectedSystemNode,
              ($event.target as HTMLSelectElement).value as SystemNodeKind,
            )
          "
        >
          <option value="client">Client</option>
          <option value="gateway">Gateway</option>
          <option value="service">Service</option>
          <option value="database">Database</option>
          <option value="cache">Cache</option>
          <option value="broker">Broker</option>
          <option value="external-system">External System</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Tecnologia</span>
        <input
          :value="selectedSystemNode.technology ?? ''"
          placeholder="ex.: Node, PostgreSQL, Kafka"
          @change="
            emit('edit', {
              type: 'updateSystemNode',
              payload: {
                id: selectedSystemNode.id,
                technology: ($event.target as HTMLInputElement).value.trim() || null,
              },
            })
          "
        />
      </label>
      <label class="ff-field">
        <span>Descrição</span>
        <textarea
          rows="2"
          :value="selectedSystemNode.description"
          @change="
            emit('edit', {
              type: 'updateSystemNode',
              payload: {
                id: selectedSystemNode.id,
                description: ($event.target as HTMLTextAreaElement).value,
              },
            })
          "
        />
      </label>

      <!-- Quick Connect Card -->
      <div v-if="otherSystemNodes.length > 0" class="ff-quick-connect" data-testid="quick-connect-box">
        <div class="ff-quick-connect__title">
          <Link2 :size="13" />
          <span>Conectar a outro nó</span>
        </div>
        <div class="ff-quick-connect__row">
          <select
            v-model="quickConnectTargetId"
            aria-label="Selecionar destino da ligação"
            data-testid="quick-connect-target"
          >
            <option value="">Escolher destino…</option>
            <option v-for="n in otherSystemNodes" :key="n.id" :value="n.id">
              {{ n.name }} ({{ n.kind }})
            </option>
          </select>
          <button
            type="button"
            class="primary"
            :disabled="!quickConnectTargetId"
            data-testid="quick-connect-btn"
            @click="handleQuickConnect"
          >
            <Plus :size="14" />
            Ligar
          </button>
        </div>
      </div>

      <div class="ff-inspector__actions">
        <button
          v-if="selectedSystemNode.kind === 'service'"
          type="button"
          class="primary"
          data-testid="btn-drilldown"
          @click="emit('drillDown', selectedSystemNode.id)"
        >
          <FolderOpen :size="14" />
          Arquitetura Interna
        </button>
        <button
          type="button"
          class="danger"
          @click="
            emit('edit', { type: 'deleteSystemNode', payload: { id: selectedSystemNode.id } });
            emit('clearSelection');
          "
        >
          <Trash2 :size="14" />
          Excluir
        </button>
      </div>
    </section>

    <!-- Selected RuntimeConnection -->
    <section v-else-if="selectedConnection" class="ff-inspector__section">
      <h4>Conexão em Runtime</h4>
      <label class="ff-field">
        <span>Tipo</span>
        <select
          :value="selectedConnection.kind"
          data-testid="inspector-conn-kind"
          @change="
            emit('edit', {
              type: 'updateRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                kind: ($event.target as HTMLSelectElement).value as RuntimeConnectionKind,
              },
            })
          "
        >
          <option value="sync-call">sync-call (Chamada síncrona)</option>
          <option value="data-access">data-access (Acesso a banco)</option>
          <option value="cache-access">cache-access (Acesso a cache)</option>
          <option value="async-publish">async-publish (Produtor → Broker)</option>
          <option value="async-consume">async-consume (Broker → Consumidor)</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Protocolo</span>
        <select
          :value="selectedConnection.protocol"
          @change="
            emit('edit', {
              type: 'updateRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                protocol: ($event.target as HTMLSelectElement).value as RuntimeProtocol,
              },
            })
          "
        >
          <option value="http">HTTP</option>
          <option value="grpc">gRPC</option>
          <option value="sql">SQL</option>
          <option value="redis">Redis</option>
          <option value="amqp">AMQP</option>
          <option value="kafka">Kafka</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Rótulo</span>
        <input
          :value="selectedConnection.label ?? ''"
          placeholder="ex.: POST /orders"
          @change="
            emit('edit', {
              type: 'updateRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                label: ($event.target as HTMLInputElement).value.trim() || null,
              },
            })
          "
        />
      </label>
      <label class="ff-field">
        <span>Origem</span>
        <select
          :value="selectedConnection.sourceId"
          @change="
            emit('edit', {
              type: 'reconnectRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                sourceId: ($event.target as HTMLSelectElement).value,
              },
            })
          "
        >
          <option v-for="n in project.topology.nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Destino</span>
        <select
          :value="selectedConnection.targetId"
          @change="
            emit('edit', {
              type: 'reconnectRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                targetId: ($event.target as HTMLSelectElement).value,
              },
            })
          "
        >
          <option v-for="n in project.topology.nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </label>
      <div class="ff-inspector__actions">
        <button
          type="button"
          @click="
            emit('edit', {
              type: 'reconnectRuntimeConnection',
              payload: {
                id: selectedConnection.id,
                sourceId: selectedConnection.targetId,
                targetId: selectedConnection.sourceId,
              },
            })
          "
        >
          <ArrowLeftRight :size="14" />
          Inverter
        </button>
        <button
          type="button"
          class="danger"
          @click="
            emit('edit', { type: 'deleteRuntimeConnection', payload: { id: selectedConnection.id } });
            emit('clearSelection');
          "
        >
          <Trash2 :size="14" />
          Excluir
        </button>
      </div>
    </section>

    <!-- Selected CodeUnit -->
    <section v-else-if="selectedCodeUnit && activeScope.level === 'internal'" class="ff-inspector__section">
      <h4>Unidade Interna (CodeUnit)</h4>
      <label class="ff-field">
        <span>Nome</span>
        <input
          :value="selectedCodeUnit.name"
          data-testid="inspector-unit-name"
          @change="
            emit('edit', {
              type: 'updateCodeUnit',
              payload: {
                serviceId: activeScope.serviceId,
                id: selectedCodeUnit.id,
                name: ($event.target as HTMLInputElement).value,
              },
            })
          "
        />
      </label>
      <label class="ff-field">
        <span>Tipo</span>
        <select
          :value="selectedCodeUnit.kind"
          @change="
            emit('edit', {
              type: 'updateCodeUnit',
              payload: {
                serviceId: activeScope.serviceId,
                id: selectedCodeUnit.id,
                kind: ($event.target as HTMLSelectElement).value as CodeUnitKind,
              },
            })
          "
        >
          <option value="inbound-adapter">Inbound Adapter</option>
          <option value="outbound-adapter">Outbound Adapter</option>
          <option value="use-case">Use Case</option>
          <option value="domain-service">Domain Service</option>
          <option value="domain-entity">Domain Entity</option>
          <option value="interface">Interface</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Camada</span>
        <select
          :value="selectedCodeUnit.layer"
          @change="
            emit('edit', {
              type: 'updateCodeUnit',
              payload: {
                serviceId: activeScope.serviceId,
                id: selectedCodeUnit.id,
                layer: ($event.target as HTMLSelectElement).value as CodeLayer,
              },
            })
          "
        >
          <option value="adapters">adapters</option>
          <option value="application">application</option>
          <option value="domain">domain</option>
        </select>
      </label>

      <!-- Quick Static Dependency Card -->
      <div v-if="otherCodeUnits.length > 0" class="ff-quick-connect" data-testid="quick-dep-box">
        <div class="ff-quick-connect__title">
          <Link2 :size="13" />
          <span>Adicionar dependência estática</span>
        </div>
        <select
          v-model="quickDepKind"
          aria-label="Tipo da dependência estática"
          data-testid="quick-dep-kind"
        >
          <option value="depends-on">depends-on (depende de)</option>
          <option value="implements">implements (implementa)</option>
        </select>
        <div class="ff-quick-connect__row">
          <select
            v-model="quickDepTargetId"
            aria-label="Selecionar unidade destino"
            data-testid="quick-dep-target"
          >
            <option value="">Escolher destino…</option>
            <option v-for="u in otherCodeUnits" :key="u.id" :value="u.id">
              {{ u.name }} ({{ u.layer }})
            </option>
          </select>
          <button
            type="button"
            class="primary"
            :disabled="!quickDepTargetId"
            data-testid="quick-dep-btn"
            @click="handleQuickAddDependency"
          >
            <Plus :size="14" />
            Ligar
          </button>
        </div>
      </div>

      <div class="ff-inspector__actions">
        <button
          type="button"
          class="danger"
          @click="
            emit('edit', {
              type: 'deleteCodeUnit',
              payload: { serviceId: activeScope.serviceId, id: selectedCodeUnit.id },
            });
            emit('clearSelection');
          "
        >
          <Trash2 :size="14" />
          Excluir Unidade
        </button>
      </div>
    </section>

    <!-- Selected StaticDependency -->
    <section
      v-else-if="selectedStaticDep && activeScope.level === 'internal'"
      class="ff-inspector__section"
    >
      <h4>Dependência Estática</h4>
      <label class="ff-field">
        <span>Relação</span>
        <select
          :value="selectedStaticDep.kind"
          data-testid="inspector-dep-kind"
          @change="
            emit('edit', {
              type: 'updateStaticDependency',
              payload: {
                serviceId: activeScope.serviceId,
                id: selectedStaticDep.id,
                kind: ($event.target as HTMLSelectElement).value as StaticDependencyKind,
              },
            })
          "
        >
          <option value="depends-on">depends-on (A depende de B)</option>
          <option value="implements">implements (A implementa Interface B)</option>
        </select>
      </label>
      <label class="ff-field">
        <span>Rótulo</span>
        <input
          :value="selectedStaticDep.label ?? ''"
          @change="
            emit('edit', {
              type: 'updateStaticDependency',
              payload: {
                serviceId: activeScope.serviceId,
                id: selectedStaticDep.id,
                label: ($event.target as HTMLInputElement).value.trim() || null,
              },
            })
          "
        />
      </label>
      <div class="ff-inspector__actions">
        <button
          type="button"
          class="danger"
          @click="
            emit('edit', {
              type: 'deleteStaticDependency',
              payload: { serviceId: activeScope.serviceId, id: selectedStaticDep.id },
            });
            emit('clearSelection');
          "
        >
          <Trash2 :size="14" />
          Excluir
        </button>
      </div>
    </section>

    <section v-else class="ff-inspector__empty">
      <p>Selecione um card ou ligação no canvas para editar propriedades ou criar conexões rápidas.</p>
    </section>

    <!-- Fixed "Fronteira Externa" section in Level 2 -->
    <section
      v-if="activeScope.level === 'internal'"
      class="ff-inspector__section ff-boundary-section"
      data-testid="external-boundary-section"
    >
      <h4>Fronteira Externa (Endpoints)</h4>
      <p v-if="projectedEndpoints.length === 0" class="ff-muted">
        Nenhuma conexão externa incidente a este serviço na Topologia (Nível 1).
      </p>
      <div
        v-for="ep in projectedEndpoints"
        :key="ep.runtimeConnectionId"
        class="ff-endpoint-card"
        :data-testid="`endpoint-${ep.runtimeConnectionId}`"
      >
        <div class="ff-endpoint-card__head">
          <span class="ff-ep-dir" :class="ep.direction">
            {{ ep.direction === 'inbound' ? '← inbound' : '→ outbound' }}
          </span>
          <span class="ff-ep-proto">{{ ep.protocol.toUpperCase() }}</span>
        </div>
        <div class="ff-endpoint-card__peer">
          <strong>{{ ep.peerNodeName }}</strong>
          <small v-if="ep.label"> ({{ ep.label }})</small>
        </div>

        <div class="ff-endpoint-card__bindings">
          <div
            v-for="b in bindingsForConnection(ep.runtimeConnectionId)"
            :key="b.id"
            class="ff-binding-pill"
          >
            <span>{{ unitNameById(b.adapterUnitId) }}</span>
            <button
              type="button"
              class="ff-binding-pill__del"
              title="Remover vínculo"
              aria-label="Remover vínculo"
              @click="emit('edit', { type: 'deleteBoundaryBinding', payload: { id: b.id } })"
            >
              <X :size="12" />
            </button>
          </div>
          <small
            v-if="bindingsForConnection(ep.runtimeConnectionId).length === 0"
            class="ff-ep-pending"
          >
            Pendente de vínculo
          </small>
        </div>

        <div v-if="adapterUnits.length > 0" class="ff-endpoint-card__bind-row">
          <select
            v-model="bindingSelections[ep.runtimeConnectionId]"
            :aria-label="`Selecionar adaptador para ${ep.peerNodeName}`"
            :data-testid="`bind-select-${ep.runtimeConnectionId}`"
          >
            <option value="">Vincular adaptador…</option>
            <option v-for="adp in adapterUnits" :key="adp.id" :value="adp.id">
              {{ adp.name }} ({{ adp.kind === 'inbound-adapter' ? 'in' : 'out' }})
            </option>
          </select>
          <button
            type="button"
            :data-testid="`bind-btn-${ep.runtimeConnectionId}`"
            :disabled="!bindingSelections[ep.runtimeConnectionId]"
            @click="handleBindEndpoint(ep.runtimeConnectionId)"
          >
            Vincular
          </button>
        </div>
      </div>
    </section>

    <!-- Confirmation dialog replacing window.confirm() for service kind change -->
    <AppDialog
      :open="pendingKindChange !== null"
      title="Limpar Arquitetura Interna?"
      @close="pendingKindChange = null"
    >
      <p class="ff-dialog-msg">
        O serviço <strong>{{ pendingKindChange?.node.name }}</strong> possui
        <strong>{{ pendingKindChange?.unitCount }}</strong> unidade(s) internas. Alterar para
        <code>{{ pendingKindChange?.nextKind }}</code> removerá sua arquitetura interna e vínculos
        (reversível em 1 Undo).
      </p>
      <template #actions>
        <button type="button" @click="pendingKindChange = null">Cancelar</button>
        <button type="button" class="danger" @click="confirmKindChange">
          Confirmar Alteração
        </button>
      </template>
    </AppDialog>
  </aside>
</template>

<style scoped>
.ff-inspector {
  width: 312px;
  flex-shrink: 0;
  background: var(--ff-surface);
  border-left: 1px solid var(--ff-border);
  padding: 14px 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ff-inspector h4 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ff-muted);
}

.ff-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.ff-inspector__empty {
  padding: 14px 12px;
  border-radius: var(--ff-radius-md);
  background: var(--ff-surface-subtle);
  border: 1px dashed var(--ff-border-strong);
  color: var(--ff-muted);
  font-size: 12px;
  line-height: 1.45;
}

.ff-inspector__empty p {
  margin: 0;
}

.ff-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.ff-field span {
  color: var(--ff-muted);
  font-weight: 500;
}

.ff-quick-connect {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border-radius: var(--ff-radius-md);
  background: var(--ff-primary-soft);
  border: 1px solid var(--ff-border);
}

.ff-quick-connect__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ff-primary-text);
}

.ff-quick-connect__row {
  display: flex;
  gap: 6px;
}

.ff-quick-connect__row select {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.ff-inspector__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.ff-boundary-section {
  padding-top: 12px;
  border-top: 1px solid var(--ff-border);
}

.ff-muted {
  font-size: 12px;
  color: var(--ff-muted);
  margin: 0;
}

.ff-endpoint-card {
  border: 1px solid var(--ff-border);
  border-radius: var(--ff-radius-md);
  padding: 9px;
  background: var(--ff-surface-subtle);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ff-endpoint-card__head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
}

.ff-ep-dir.inbound {
  color: var(--ff-primary-text);
}

.ff-ep-dir.outbound {
  color: #a855f7;
}

.ff-ep-proto {
  background: var(--ff-surface-hover);
  color: var(--ff-text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.ff-endpoint-card__peer {
  font-size: 12.5px;
}

.ff-endpoint-card__bindings {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ff-binding-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--ff-primary-soft);
  color: var(--ff-primary-text);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 500;
}

.ff-binding-pill__del {
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
}

.ff-ep-pending {
  color: var(--ff-warning);
  font-size: 11px;
  font-weight: 500;
}

.ff-endpoint-card__bind-row {
  display: flex;
  gap: 5px;
}

.ff-endpoint-card__bind-row select {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
}

.ff-dialog-msg {
  margin: 0;
}
</style>
