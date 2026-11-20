<script setup lang="ts">
import { ref } from 'vue';
import type { Diagnostic } from '@rules/types';

defineProps<{
  diagnostics: readonly Diagnostic[];
  errorCount: number;
  warningCount: number;
}>();

const emit = defineEmits<{
  selectDiagnostic: [diagnostic: Diagnostic];
}>();

const expanded = ref(true);
</script>

<template>
  <section class="ff-diagnostics" data-testid="diagnostics-panel">
    <header class="ff-diagnostics__header" @click="expanded = !expanded">
      <div class="ff-diagnostics__summary">
        <strong>Diagnósticos ({{ diagnostics.length }})</strong>
        <span class="ff-pill ff-pill--error" data-testid="diag-error-count">
          Erros: {{ errorCount }}
        </span>
        <span class="ff-pill ff-pill--warning" data-testid="diag-warning-count">
          Avisos: {{ warningCount }}
        </span>
      </div>
      <button type="button" class="ff-toggle-btn">
        {{ expanded ? 'Recolher ▾' : 'Expandir ▴' }}
      </button>
    </header>

    <div v-if="expanded" class="ff-diagnostics__body">
      <p v-if="diagnostics.length === 0" class="ff-diagnostics__empty" data-testid="diag-empty">
        ✓ Nenhuma violação arquitetural detectada no modelo atual.
      </p>
      <ul v-else class="ff-diagnostics__list">
        <li
          v-for="diag in diagnostics"
          :key="diag.id"
          class="ff-diag-item"
          :class="`ff-diag-item--${diag.severity}`"
          :data-testid="`diag-item-${diag.ruleId}`"
          @click="emit('selectDiagnostic', diag)"
        >
          <div class="ff-diag-item__top">
            <span class="ff-diag-badge" :class="diag.severity">{{ diag.severity.toUpperCase() }}</span>
            <code class="ff-diag-rule">{{ diag.ruleId }}</code>
            <span class="ff-diag-title">{{ diag.title }}</span>
          </div>
          <div class="ff-diag-item__msg">{{ diag.message }}</div>
          <div class="ff-diag-item__hint">Sugestão: {{ diag.suggestion }}</div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.ff-diagnostics {
  background: var(--ff-surface);
  border-top: 1px solid var(--ff-border);
  display: flex;
  flex-direction: column;
  max-height: 220px;
}

.ff-diagnostics__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  cursor: pointer;
  background: #f8fafc;
  border-bottom: 1px solid var(--ff-border);
  font-size: 12px;
}

.ff-diagnostics__summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ff-pill {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.ff-pill--error {
  background: var(--ff-error-bg);
  color: var(--ff-error);
}

.ff-pill--warning {
  background: var(--ff-warning-bg);
  color: var(--ff-warning);
}

.ff-toggle-btn {
  font-size: 11px;
  padding: 2px 8px;
}

.ff-diagnostics__body {
  overflow-y: auto;
  padding: 6px 14px;
}

.ff-diagnostics__empty {
  margin: 6px 0;
  font-size: 12px;
  color: var(--ff-success);
  font-weight: 500;
}

.ff-diagnostics__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ff-diag-item {
  border: 1px solid var(--ff-border);
  border-left-width: 4px;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}

.ff-diag-item:hover {
  background: #f8fafc;
}

.ff-diag-item--error {
  border-left-color: var(--ff-error);
}

.ff-diag-item--warning {
  border-left-color: var(--ff-warning);
}

.ff-diag-item__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.ff-diag-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}

.ff-diag-badge.error {
  background: var(--ff-error-bg);
  color: var(--ff-error);
}

.ff-diag-badge.warning {
  background: var(--ff-warning-bg);
  color: var(--ff-warning);
}

.ff-diag-rule {
  font-size: 11px;
  color: var(--ff-muted);
}

.ff-diag-title {
  font-weight: 600;
}

.ff-diag-item__msg {
  color: var(--ff-text);
}

.ff-diag-item__hint {
  color: var(--ff-muted);
  font-size: 11px;
  margin-top: 2px;
}
</style>
