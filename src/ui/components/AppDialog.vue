<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{
  open: boolean;
  title: string;
  testId?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = useId();

function syncOpenState(isOpen: boolean): void {
  const el = dialogRef.value;
  if (!el) return;
  if (isOpen) {
    if (!el.open && typeof el.showModal === 'function') {
      el.showModal();
    }
  } else if (el.open && typeof el.close === 'function') {
    el.close();
  }
}

watch(
  () => props.open,
  (next) => syncOpenState(next),
  { flush: 'post' },
);

// Fallback for browsers without native <dialog closedby="any"> support (e.g. Safari)
function handleBackdropClick(event: MouseEvent): void {
  const dialog = dialogRef.value;
  if (!dialog) return;
  if ('closedBy' in HTMLDialogElement.prototype) return;
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  const inside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!inside) {
    dialog.close();
  }
}

function handleNativeClose(): void {
  if (props.open) {
    emit('close');
  }
}

onMounted(() => {
  syncOpenState(props.open);
});

onBeforeUnmount(() => {
  const el = dialogRef.value;
  if (el?.open && typeof el.close === 'function') {
    el.close();
  }
});
</script>

<template>
  <dialog
    ref="dialogRef"
    class="ff-dialog"
    closedby="any"
    :aria-labelledby="titleId"
    :data-testid="testId"
    @close="handleNativeClose"
    @click="handleBackdropClick"
  >
    <div v-if="open" class="ff-dialog__inner">
      <header class="ff-dialog__header">
        <h3 :id="titleId" class="ff-dialog__title">{{ title }}</h3>
        <button
          type="button"
          class="ghost icon-btn"
          aria-label="Fechar janela"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </header>
      <div class="ff-dialog__body">
        <slot />
      </div>
      <footer v-if="$slots.actions" class="ff-dialog__footer">
        <slot name="actions" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.ff-dialog__inner {
  display: flex;
  flex-direction: column;
}

.ff-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--ff-border);
}

.ff-dialog__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.ff-dialog__body {
  padding: 16px 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ff-text-secondary);
}

.ff-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ff-border);
  background: var(--ff-surface-subtle);
  border-bottom-left-radius: var(--ff-radius-lg);
  border-bottom-right-radius: var(--ff-radius-lg);
}
</style>
