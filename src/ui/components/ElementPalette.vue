<script setup lang="ts">
import { DEFAULT_LAYER_BY_UNIT_KIND } from '@domain/limits';
import type { CodeUnitKind, SystemNodeKind, ViewScope } from '@domain/types';

defineProps<{
  activeScope: ViewScope;
}>();

const emit = defineEmits<{
  addSystemNode: [kind: SystemNodeKind, defaultName: string];
  addCodeUnit: [kind: CodeUnitKind, defaultName: string];
}>();

const SYSTEM_ITEMS: readonly { readonly kind: SystemNodeKind; readonly label: string }[] = [
  { kind: 'client', label: 'Client' },
  { kind: 'gateway', label: 'Gateway' },
  { kind: 'service', label: 'Service (drill-down)' },
  { kind: 'database', label: 'Database' },
  { kind: 'cache', label: 'Cache' },
  { kind: 'broker', label: 'Broker' },
  { kind: 'external-system', label: 'External System' },
];

const INTERNAL_ITEMS: readonly { readonly kind: CodeUnitKind; readonly label: string }[] = [
  { kind: 'inbound-adapter', label: 'Inbound Adapter' },
  { kind: 'outbound-adapter', label: 'Outbound Adapter' },
  { kind: 'use-case', label: 'Use Case' },
  { kind: 'domain-service', label: 'Domain Service' },
  { kind: 'domain-entity', label: 'Domain Entity' },
  { kind: 'interface', label: 'Interface' },
];
</script>

<template>
  <aside class="ff-palette" aria-label="Paleta de elementos">
    <div class="ff-palette__section">
      <h4>{{ activeScope.level === 'system' ? 'Nível 1 — Topologia' : 'Nível 2 — Arquitetura Interna' }}</h4>
      <div v-if="activeScope.level === 'system'" class="ff-palette__list">
        <button
          v-for="item in SYSTEM_ITEMS"
          :key="item.kind"
          class="ff-palette__btn"
          :data-testid="`palette-system-${item.kind}`"
          @click="emit('addSystemNode', item.kind, `Novo ${item.label.split(' ')[0]}`)"
        >
          + {{ item.label }}
        </button>
      </div>
      <div v-else class="ff-palette__list">
        <button
          v-for="item in INTERNAL_ITEMS"
          :key="item.kind"
          class="ff-palette__btn"
          :data-testid="`palette-internal-${item.kind}`"
          @click="emit('addCodeUnit', item.kind, `Novo ${item.label}`)"
        >
          <span>+ {{ item.label }}</span>
          <small class="ff-palette__layer">{{ DEFAULT_LAYER_BY_UNIT_KIND[item.kind] }}</small>
        </button>
      </div>
    </div>

    <div class="ff-palette__legend">
      <h5>Sentido das Setas</h5>
      <template v-if="activeScope.level === 'system'">
        <p><strong>Sólida:</strong> A chama / acessa B (<code>sync-call</code>, <code>data-access</code>, <code>cache-access</code>)</p>
        <p><strong>Tracejada:</strong> Fluxo da mensagem (<code>Produtor → Broker</code> / <code>Broker → Consumidor</code>)</p>
      </template>
      <template v-else>
        <p><strong>Contínua:</strong> A depende de B (<code>depends-on</code>)</p>
        <p><strong>Pontilhada:</strong> A implementa B (<code>implements</code> → <code>Interface</code>)</p>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.ff-palette {
  width: 215px;
  flex-shrink: 0;
  background: var(--ff-surface);
  border-right: 1px solid var(--ff-border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.ff-palette h4 {
  margin: 0 0 10px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--ff-muted);
}

.ff-palette__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ff-palette__btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  padding: 7px 9px;
  font-size: 12px;
}

.ff-palette__layer {
  font-size: 10px;
  color: var(--ff-muted);
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
}

.ff-palette__legend {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid var(--ff-border);
  font-size: 11px;
  color: var(--ff-muted);
}

.ff-palette__legend h5 {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--ff-text);
}

.ff-palette__legend p {
  margin: 4px 0;
  line-height: 1.4;
}
</style>
