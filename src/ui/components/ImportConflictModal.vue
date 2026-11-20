<script setup lang="ts">
import type { ImportConflictStrategy } from '@application/use-cases/importExportProject';
import type { ImportModalState } from '../composables/useWorkspace';
import AppDialog from './AppDialog.vue';

defineProps<{
  state: ImportModalState;
}>();

const emit = defineEmits<{
  resolveConflict: [strategy: ImportConflictStrategy];
  close: [];
}>();
</script>

<template>
  <AppDialog
    :open="state.open"
    :title="
      state.mode === 'conflict'
        ? 'Projeto com mesmo ID encontrado'
        : 'Erro na Importação JSON'
    "
    test-id="import-modal"
    @close="emit('close')"
  >
    <p class="ff-import-msg" data-testid="import-modal-message">{{ state.message }}</p>

    <ul v-if="state.details.length > 0" class="ff-error-list">
      <li v-for="(detail, idx) in state.details.slice(0, 8)" :key="idx">{{ detail }}</li>
    </ul>

    <template #actions>
      <template v-if="state.mode === 'conflict'">
        <button type="button" @click="emit('close')">Cancelar</button>
        <button type="button" data-testid="btn-import-copy" @click="emit('resolveConflict', 'copy')">
          Importar como cópia
        </button>
        <button
          type="button"
          class="primary"
          data-testid="btn-import-replace"
          @click="emit('resolveConflict', 'replace')"
        >
          Substituir projeto existente
        </button>
      </template>
      <template v-else>
        <button type="button" class="primary" data-testid="btn-import-close" @click="emit('close')">
          Fechar
        </button>
      </template>
    </template>
  </AppDialog>
</template>

<style scoped>
.ff-import-msg {
  margin: 0;
  color: var(--ff-text);
}

.ff-error-list {
  margin: 10px 0 0;
  padding: 10px 12px 10px 26px;
  border-radius: var(--ff-radius-sm);
  background: var(--ff-error-bg);
  border: 1px solid var(--ff-error-border);
  font-size: 12px;
  color: var(--ff-error);
  max-height: 160px;
  overflow-y: auto;
}
</style>
