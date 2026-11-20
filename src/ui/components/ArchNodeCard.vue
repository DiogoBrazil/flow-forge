<script setup lang="ts">
import { Handle, Position } from '@xyflow/vue';
import type { NodeProps } from '@xyflow/vue';
import type { ArchFlowNode } from '@diagram-adapter/useVueFlowAdapter';

defineProps<NodeProps<ArchFlowNode>>();
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
    <Handle type="target" :position="Position.Left" />
    <div class="ff-node__header">
      <span class="ff-node__kind">{{ data.kindLabel }}</span>
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
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.ff-node {
  width: 220px;
  min-height: 84px;
  background: #ffffff;
  border: 2px solid #334155;
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.ff-node--service {
  border-color: #2563eb;
}
.ff-node--database {
  border-color: #0369a1;
}
.ff-node--cache {
  border-color: #0d9488;
}
.ff-node--broker {
  border-color: #7c3aed;
}
.ff-node--interface {
  border-style: dashed;
  border-color: #059669;
}
.ff-node--selected {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
}
.ff-node--highlighted {
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.45);
}
.ff-node--warning {
  border-color: #d97706;
}
.ff-node--error {
  border-color: #dc2626;
}

.ff-node__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
  margin-bottom: 4px;
}

.ff-node__layer {
  background: #f1f5f9;
  color: #334155;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.ff-node__drill {
  color: #2563eb;
  font-weight: 700;
}

.ff-node__title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.ff-node__tech {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.ff-node__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.ff-node__badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.ff-node__badge--bound {
  background: #dbeafe;
  color: #1e40af;
}

.ff-node__badge--warning {
  background: #fef3c7;
  color: #92400e;
}
</style>
