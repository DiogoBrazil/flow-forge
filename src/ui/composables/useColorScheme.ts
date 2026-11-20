import { onBeforeUnmount, onMounted, ref } from 'vue';

type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

function getSystemScheme(): ResolvedScheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredScheme(): ResolvedScheme | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

function applyMetaScheme(stored: ResolvedScheme | null): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = stored ?? 'light dark';
  }
}

export function useColorScheme() {
  const storedScheme = ref<ResolvedScheme | null>(readStoredScheme());
  const resolvedScheme = ref<ResolvedScheme>(storedScheme.value ?? getSystemScheme());

  function syncFromStorageAndSystem(): void {
    storedScheme.value = readStoredScheme();
    applyMetaScheme(storedScheme.value);
    resolvedScheme.value = storedScheme.value ?? getSystemScheme();
  }

  function toggleColorScheme(): void {
    const currentRendered = storedScheme.value ?? getSystemScheme();
    const target: ResolvedScheme = currentRendered === 'dark' ? 'light' : 'dark';
    const system = getSystemScheme();

    if (target === system) {
      // Revert to following OS preference
      storedScheme.value = null;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    } else {
      storedScheme.value = target;
      try {
        localStorage.setItem(STORAGE_KEY, target);
      } catch {
        // Ignore storage restrictions
      }
    }

    applyMetaScheme(storedScheme.value);
    resolvedScheme.value = target;
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === STORAGE_KEY) {
      syncFromStorageAndSystem();
    }
  }

  function handleSystemChange(): void {
    if (storedScheme.value === null) {
      resolvedScheme.value = getSystemScheme();
    }
  }

  let mediaQuery: MediaQueryList | null = null;

  onMounted(() => {
    syncFromStorageAndSystem();
    window.addEventListener('storage', handleStorageEvent);
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handleSystemChange);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('storage', handleStorageEvent);
    mediaQuery?.removeEventListener('change', handleSystemChange);
  });

  return {
    resolvedScheme,
    storedScheme,
    toggleColorScheme,
  };
}
