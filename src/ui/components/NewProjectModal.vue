<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RuleProfileId } from '@domain/types';
import AppDialog from './AppDialog.vue';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [name: string, ruleProfile: RuleProfileId];
}>();

const projectName = ref('Novo Sistema');
const ruleProfile = ref<RuleProfileId>('hexagonal');

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      projectName.value = 'Novo Sistema';
      ruleProfile.value = 'hexagonal';
    }
  },
);

function handleSubmit(): void {
  const trimmed = projectName.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed, ruleProfile.value);
}
</script>

<template>
  <AppDialog :open="open" title="Criar Novo Projeto" test-id="new-project-modal" @close="emit('close')">
    <form id="new-project-form" class="ff-form" @submit.prevent="handleSubmit">
      <label class="ff-form__field">
        <span>Nome do projeto</span>
        <input
          v-model="projectName"
          type="text"
          maxlength="120"
          required
          placeholder="ex.: Plataforma de Pagamentos"
          data-testid="new-project-name-input"
        />
      </label>
      <label class="ff-form__field">
        <span>Perfil de validação arquitetural</span>
        <select v-model="ruleProfile" data-testid="new-project-profile-select">
          <option value="hexagonal">Hexagonal (Ports &amp; Adapters)</option>
          <option value="layered">Camadas (Layered)</option>
          <option value="distributed-baseline">Baseline Distribuído</option>
        </select>
      </label>
    </form>

    <template #actions>
      <button type="button" @click="emit('close')">Cancelar</button>
      <button
        type="submit"
        form="new-project-form"
        class="primary"
        :disabled="!projectName.trim()"
        data-testid="new-project-submit"
      >
        Criar Projeto
      </button>
    </template>
  </AppDialog>
</template>

<style scoped>
.ff-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ff-form__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ff-text);
}
</style>
