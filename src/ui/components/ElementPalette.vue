<script setup lang="ts">
import type { Component } from 'vue';
import {
  ArrowLeftFromLine,
  ArrowRightToLine,
  Box,
  Cloud,
  Cpu,
  Database,
  FileCode2,
  Globe,
  Plus,
  Radio,
  Server,
  Shield,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import { DEFAULT_LAYER_BY_UNIT_KIND } from '@domain/limits';
import type { CodeUnitKind, SystemNodeKind, ViewScope } from '@domain/types';

defineProps<{
  activeScope: ViewScope;
}>();

const emit = defineEmits<{
  addSystemNode: [kind: SystemNodeKind, defaultName: string];
  addCodeUnit: [kind: CodeUnitKind, defaultName: string];
}>();

const SYSTEM_ITEMS: readonly {
  readonly kind: SystemNodeKind;
  readonly label: string;
  readonly accent: string;
  readonly icon: Component;
  readonly hint?: string;
}[] = [
  { kind: 'client', label: 'Client', accent: '#6366f1', icon: Globe },
  { kind: 'gateway', label: 'Gateway', accent: '#0ea5e9', icon: Shield },
  { kind: 'service', label: 'Service', accent: '#2563eb', icon: Server, hint: 'drill-down' },
  { kind: 'database', label: 'Database', accent: '#0369a1', icon: Database },
  { kind: 'cache', label: 'Cache', accent: '#0d9488', icon: Zap },
  { kind: 'broker', label: 'Broker', accent: '#7c3aed', icon: Radio },
  { kind: 'external-system', label: 'External System', accent: '#64748b', icon: Cloud },
];

const INTERNAL_ITEMS: readonly {
  readonly kind: CodeUnitKind;
  readonly label: string;
  readonly accent: string;
  readonly icon: Component;
}[] = [
  { kind: 'inbound-adapter', label: 'Inbound Adapter', accent: '#2563eb', icon: ArrowRightToLine },
  { kind: 'outbound-adapter', label: 'Outbound Adapter', accent: '#2563eb', icon: ArrowLeftFromLine },
  { kind: 'use-case', label: 'Use Case', accent: '#8b5cf6', icon: Workflow },
  { kind: 'domain-service', label: 'Domain Service', accent: '#f59e0b', icon: Cpu },
  { kind: 'domain-entity', label: 'Domain Entity', accent: '#f59e0b', icon: Box },
  { kind: 'interface', label: 'Interface', accent: '#059669', icon: FileCode2 },
];
</script>

<template>
  <aside class="ff-palette" aria-label="Paleta de elementos">
    <div class="ff-palette__section">
      <div class="ff-palette__heading">
        <h4>{{ activeScope.level === 'system' ? 'Nível 1 — Topologia' : 'Nível 2 — Interno' }}</h4>
        <p class="ff-palette__sub">Clique para adicionar ao canvas</p>
      </div>

      <div v-if="activeScope.level === 'system'" class="ff-palette__list">
        <button
          v-for="item in SYSTEM_ITEMS"
          :key="item.kind"
          class="ff-palette__btn"
          :style="{ '--item-accent': item.accent }"
          :data-testid="`palette-system-${item.kind}`"
          @click="emit('addSystemNode', item.kind, `Novo ${item.label}`)"
        >
          <span class="ff-palette__btn-main">
            <component :is="item.icon" :size="15" class="ff-palette__icon" />
            <span>{{ item.label }}</span>
          </span>
          <span v-if="item.hint" class="ff-palette__tag">{{ item.hint }}</span>
          <Plus v-else :size="13" class="ff-palette__plus" />
        </button>
      </div>

      <div v-else class="ff-palette__list">
        <button
          v-for="item in INTERNAL_ITEMS"
          :key="item.kind"
          class="ff-palette__btn"
          :style="{ '--item-accent': item.accent }"
          :data-testid="`palette-internal-${item.kind}`"
          @click="emit('addCodeUnit', item.kind, `Novo ${item.label}`)"
        >
          <span class="ff-palette__btn-main">
            <component :is="item.icon" :size="15" class="ff-palette__icon" />
            <span>{{ item.label }}</span>
          </span>
          <small class="ff-palette__tag">{{ DEFAULT_LAYER_BY_UNIT_KIND[item.kind] }}</small>
        </button>
      </div>
    </div>

    <div class="ff-palette__legend">
      <h5>Sentido das Setas</h5>
      <template v-if="activeScope.level === 'system'">
        <div class="ff-legend-row">
          <span class="ff-legend-line ff-legend-line--solid" />
          <span><strong>Runtime:</strong> A chama / acessa B</span>
        </div>
        <div class="ff-legend-row">
          <span class="ff-legend-line ff-legend-line--dashed" />
          <span><strong>Broker:</strong> Produtor → Broker → Consumidor</span>
        </div>
      </template>
      <template v-else>
        <div class="ff-legend-row">
          <span class="ff-legend-line ff-legend-line--solid" />
          <span><strong>depends-on:</strong> A depende de B</span>
        </div>
        <div class="ff-legend-row">
          <span class="ff-legend-line ff-legend-line--dotted" />
          <span><strong>implements:</strong> A implementa Interface B</span>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.ff-palette {
  width: 232px;
  flex-shrink: 0;
  background: var(--ff-surface);
  border-right: 1px solid var(--ff-border);
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: auto;
}

.ff-palette__heading {
  margin-bottom: 10px;
}

.ff-palette h4 {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ff-muted);
}

.ff-palette__sub {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--ff-muted);
}

.ff-palette__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ff-palette__btn {
  width: 100%;
  justify-content: space-between;
  text-align: left;
  padding: 8px 10px;
  font-size: 12.5px;
  border-left: 3px solid var(--item-accent);
  background: var(--ff-surface-subtle);
}

.ff-palette__btn:hover {
  background: var(--ff-surface-hover);
}

.ff-palette__btn-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ff-palette__icon {
  color: var(--item-accent);
  flex-shrink: 0;
}

.ff-palette__plus {
  color: var(--ff-muted);
  opacity: 0.7;
}

.ff-palette__tag {
  font-size: 10px;
  font-weight: 600;
  color: var(--ff-muted);
  background: var(--ff-surface-hover);
  padding: 2px 6px;
  border-radius: 4px;
}

.ff-palette__legend {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--ff-border);
  font-size: 11px;
  color: var(--ff-muted);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ff-palette__legend h5 {
  margin: 0 0 2px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ff-text-secondary);
}

.ff-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.35;
}

.ff-legend-line {
  width: 22px;
  height: 0;
  flex-shrink: 0;
  border-top: 2px solid var(--ff-text-secondary);
}

.ff-legend-line--dashed {
  border-top-style: dashed;
  border-top-color: #7c3aed;
}

.ff-legend-line--dotted {
  border-top-style: dotted;
  border-top-color: #059669;
}
</style>
