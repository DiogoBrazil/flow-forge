<script setup lang="ts">
import { computed, ref } from 'vue';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-vue-next';
import type { Diagnostic } from '@rules/types';

const props = defineProps<{
  diagnostics: readonly Diagnostic[];
  errorCount: number;
  warningCount: number;
}>();

const emit = defineEmits<{
  selectDiagnostic: [diagnostic: Diagnostic];
}>();

const expanded = ref(true);
const filter = ref<'all' | 'error' | 'warning'>('all');

const filteredDiagnostics = computed(() => {
  if (filter.value === 'all') return props.diagnostics;
  return props.diagnostics.filter((d) => d.severity === filter.value);
});
</script>

<template>
  <section class="ff-diagnostics" data-testid="diagnostics-panel">
    <header class="ff-diagnostics__header">
      <div class="ff-diagnostics__summary" @click="expanded = !expanded">
        <strong>Diagnósticos</strong>
        <span class="ff-count-badge">{{ diagnostics.length }}</span>
        <span class="ff-pill ff-pill--error" data-testid="diag-error-count">
          <AlertCircle :size="12" />
          Erros: {{ errorCount }}
        </span>
        <span class="ff-pill ff-pill--warning" data-testid="diag-warning-count">
          <AlertTriangle :size="12" />
          Avisos: {{ warningCount }}
        </span>
      </div>

      <div class="ff-diagnostics__controls">
        <div v-if="expanded && diagnostics.length > 0" class="ff-filter-tabs" role="tablist">
          <button
            type="button"
            class="ff-filter-tab"
            :class="{ active: filter === 'all' }"
            @click="filter = 'all'"
          >
            Todos
          </button>
          <button
            type="button"
            class="ff-filter-tab"
            :class="{ active: filter === 'error' }"
            @click="filter = 'error'"
          >
            Erros ({{ errorCount }})
          </button>
          <button
            type="button"
            class="ff-filter-tab"
            :class="{ active: filter === 'warning' }"
            @click="filter = 'warning'"
          >
            Avisos ({{ warningCount }})
          </button>
        </div>

        <button type="button" class="ghost ff-toggle-btn" @click="expanded = !expanded">
          <ChevronDown v-if="expanded" :size="14" />
          <ChevronUp v-else :size="14" />
          <span>{{ expanded ? 'Recolher' : 'Expandir' }}</span>
        </button>
      </div>
    </header>

    <div v-if="expanded" class="ff-diagnostics__body">
      <p v-if="diagnostics.length === 0" class="ff-diagnostics__empty" data-testid="diag-empty">
        <CheckCircle2 :size="15" />
        <span>Nenhuma violação arquitetural detectada no modelo atual.</span>
      </p>
      <p v-else-if="filteredDiagnostics.length === 0" class="ff-diagnostics__muted">
        Nenhum diagnóstico para o filtro selecionado.
      </p>
      <ul v-else class="ff-diagnostics__list">
        <li
          v-for="diag in filteredDiagnostics"
          :key="diag.id"
          class="ff-diag-item"
          :class="`ff-diag-item--${diag.severity}`"
          :data-testid="`diag-item-${diag.ruleId}`"
          @click="emit('selectDiagnostic', diag)"
        >
          <div class="ff-diag-item__top">
            <span class="ff-diag-badge" :class="diag.severity">
              {{ diag.severity.toUpperCase() }}
            </span>
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
  max-height: 224px;
}

.ff-diagnostics__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px;
  background: var(--ff-surface-subtle);
  border-bottom: 1px solid var(--ff-border);
  font-size: 12px;
}

.ff-diagnostics__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.ff-count-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--ff-surface-hover);
  color: var(--ff-text-secondary);
}

.ff-diagnostics__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ff-filter-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: var(--ff-surface);
  border: 1px solid var(--ff-border);
}

.ff-filter-tab {
  border: none;
  background: transparent;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--ff-muted);
}

.ff-filter-tab.active {
  background: var(--ff-primary-soft);
  color: var(--ff-primary-text);
  font-weight: 600;
}

.ff-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
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
  font-size: 11.5px;
  padding: 3px 8px;
}

.ff-diagnostics__body {
  overflow-y: auto;
  padding: 8px 14px;
}

.ff-diagnostics__empty {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 4px 0;
  font-size: 12.5px;
  color: var(--ff-success);
  font-weight: 500;
}

.ff-diagnostics__muted {
  margin: 4px 0;
  font-size: 12px;
  color: var(--ff-muted);
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
  border-radius: var(--ff-radius-sm);
  padding: 7px 11px;
  cursor: pointer;
  font-size: 12px;
  background: var(--ff-surface-subtle);
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

.ff-diag-item:hover {
  background: var(--ff-surface-hover);
}

.ff-diag-item--error {
  border-left-color: var(--ff-error);
}

.ff-diag-item--warning {
  border-left-color: var(--ff-warning);
}

.ff-diag-item__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.ff-diag-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
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
  font-family: var(--ff-mono);
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
