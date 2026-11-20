<script setup lang="ts">
import type { ImportConflictStrategy } from '@application/use-cases/importExportProject';
import type { ImportModalState } from '../composables/useWorkspace';

defineProps<{
  state: ImportModalState;
}>();

const emit = defineEmits<{
  resolveConflict: [strategy: ImportConflictStrategy];
  close: [];
}>();
</script>

<template>
  <div
    v-if="state.open"
    class="ff-modal-backdrop"
    role="dialog"
    aria-modal="true"
    data-testid="import-modal"
  >
    <div class="ff-modal">
      <h3>
        {{ state.mode === 'conflict' ? 'Projeto com mesmo ID encontrado' : 'Erro na Importação JSON' }}
      </h3>
      <p data-testid="import-modal-message">{{ state.message }}</p>

      <ul v-if="state.details.length > 0" class="ff-error-list">
        <li v-for="(detail, idx) in state.details.slice(0, 8)" :key="idx">{{ detail }}</li>
      </ul>

      <div class="ff-modal__actions">
        <template v-if="state.mode === 'conflict'">
          <button @click="emit('close')">Cancelar</button>
          <button data-testid="btn-import-copy" @click="emit('resolveConflict', 'copy')">
            Importar como cópia
          </button>
          <button
            class="primary"
            data-testid="btn-import-replace"
            @click="emit('resolveConflict', 'replace')"
          >
            Substituir projeto existente
          </button>
        </template>
        <template v-else>
          <button class="primary" data-testid="btn-import-close" @click="emit('close')">
            Fechar
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ff-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.ff-modal {
  background: var(--ff-surface);
  border-radius: 10px;
  padding: 20px;
  width: 480px;
  max-width: 92vw;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
}

.ff-modal h3 {
  margin: 0 0 8px;
}

.ff-error-list {
  margin: 8px 0 14px;
  padding-left: 18px;
  font-size: 12px;
  color: var(--ff-error);
  max-height: 160px;
  overflow-y: auto;
}

.ff-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
