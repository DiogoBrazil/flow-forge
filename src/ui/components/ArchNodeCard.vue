<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { Handle, Position } from '@xyflow/vue';
import type { NodeProps } from '@xyflow/vue';
import {
  ArrowLeftFromLine,
  ArrowRightToLine,
  Box,
  Cloud,
  Cpu,
  Database,
  FileCode2,
  Globe,
  Radio,
  Server,
  Shield,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import type { ArchFlowNode } from '@diagram-adapter/useVueFlowAdapter';

const props = defineProps<NodeProps<ArchFlowNode>>();

const ICON_BY_KIND: Record<string, Component> = {
  client: Globe,
  gateway: Shield,
  service: Server,
  database: Database,
  cache: Zap,
  broker: Radio,
  'external-system': Cloud,
  'inbound-adapter': ArrowRightToLine,
  'outbound-adapter': ArrowLeftFromLine,
  'use-case': Workflow,
  'domain-service': Cpu,
  'domain-entity': Box,
  interface: FileCode2,
};

const iconComponent = computed(() => ICON_BY_KIND[props.data.kind] ?? Box);
</script>

<template>
  <div
    class="ff-node"
    :class="[
      `ff-node--${data.kind}`,
      {
        'ff-node--error': data.diagnosticSeverity === 'error',
        'ff-node--warning': data.diagnosticSeverity === 'warning',
        'ff-node--highlighted': data.highlighted,
        'ff-node--selected': selected,
      },
    ]"
    :data-node-id="id"
    :data-kind="data.kind"
  >
    <Handle
      type="target"
      :position="Position.Left"
      class="ff-handle ff-handle--target"
      title="Entrada: solte uma ligação aqui"
    />
    <div class="ff-node__header">
      <span class="ff-node__kind">
        <component :is="iconComponent" :size="13" class="ff-node__icon" />
        {{ data.kindLabel }}
      </span>
      <span v-if="data.layer" class="ff-node__layer">{{ data.layer }}</span>
      <span
        v-if="data.drillable"
        class="ff-node__drill"
        title="Duplo clique para abrir a arquitetura interna"
      >
        ↳ interno
      </span>
    </div>
    <div class="ff-node__title">{{ data.label }}</div>
    <div v-if="data.technology" class="ff-node__tech">{{ data.technology }}</div>
    <div v-if="data.badges.length > 0" class="ff-node__badges">
      <span
        v-for="(badge, idx) in data.badges"
        :key="idx"
        class="ff-node__badge"
        :class="`ff-node__badge--${badge.variant}`"
      >
        {{ badge.text }}
      </span>
    </div>
    <Handle
      type="source"
      :position="Position.Right"
      class="ff-handle ff-handle--source"
      title="Saída: arraste até o ponto esquerdo de outro card para conectar"
    />
  </div>
</template>

<style scoped>
.ff-node {
  width: 226px;
  min-height: 86px;
  background: var(--ff-surface-elevated);
  border: 1.5px solid var(--ff-border-strong);
  border-left-width: 4px;
  border-radius: 10px;
  padding: 9px 12px;
  box-shadow: var(--ff-shadow-sm);
  transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.12s ease;
}

.ff-node:hover {
  box-shadow: var(--ff-shadow-md);
}

.ff-node--client {
  border-left-color: #6366f1;
}
.ff-node--gateway {
  border-left-color: #0ea5e9;
}
.ff-node--service {
  border-left-color: #2563eb;
}
.ff-node--database {
  border-left-color: #0369a1;
}
.ff-node--cache {
  border-left-color: #0d9488;
}
.ff-node--broker {
  border-left-color: #7c3aed;
}
.ff-node--external-system {
  border-left-color: #64748b;
}
.ff-node--inbound-adapter,
.ff-node--outbound-adapter {
  border-left-color: #2563eb;
}
.ff-node--use-case {
  border-left-color: #8b5cf6;
}
.ff-node--domain-service,
.ff-node--domain-entity {
  border-left-color: #f59e0b;
}
.ff-node--interface {
  border-style: dashed;
  border-left-style: solid;
  border-left-color: #059669;
}

.ff-node--selected {
  border-color: var(--ff-primary);
  box-shadow: 0 0 0 3px var(--ff-primary-soft), var(--ff-shadow-md);
}
.ff-node--highlighted {
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.45);
}
.ff-node--warning {
  border-color: var(--ff-warning);
}
.ff-node--error {
  border-color: var(--ff-error);
}

.ff-node__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ff-muted);
  margin-bottom: 5px;
}

.ff-node__kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.ff-node__icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.ff-node__layer {
  background: var(--ff-surface-hover);
  color: var(--ff-text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.ff-node__drill {
  color: var(--ff-primary-text);
  background: var(--ff-primary-soft);
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 9.5px;
}

.ff-node__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ff-text);
  word-break: break-word;
}

.ff-node__tech {
  font-size: 11px;
  color: var(--ff-muted);
  margin-top: 2px;
}

.ff-node__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.ff-node__badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.ff-node__badge--bound {
  background: var(--ff-primary-soft);
  color: var(--ff-primary-text);
}

.ff-node__badge--warning {
  background: var(--ff-warning-bg);
  color: var(--ff-warning);
}

/* Visible, high-affordance connection handles */
:deep(.ff-handle) {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid var(--ff-surface-elevated);
  background: var(--ff-primary);
  box-shadow: 0 0 0 1px var(--ff-border-strong);
  transition: transform 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease;
}

:deep(.ff-handle--target) {
  left: -7px;
  background: #64748b;
}

:deep(.ff-handle--source) {
  right: -7px;
  background: var(--ff-primary);
}

.ff-node:hover :deep(.ff-handle) {
  transform: scale(1.25);
  box-shadow: 0 0 0 3px var(--ff-primary-soft);
}

:deep(.ff-handle:hover) {
  transform: scale(1.45) !important;
  background: var(--ff-success) !important;
}
</style>
