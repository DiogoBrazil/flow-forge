import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '@rules': fileURLToPath(new URL('./src/rules', import.meta.url)),
      '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
      '@schemas': fileURLToPath(new URL('./src/schemas', import.meta.url)),
      '@examples': fileURLToPath(new URL('./src/examples', import.meta.url)),
      '@storage': fileURLToPath(new URL('./src/storage', import.meta.url)),
      '@layout': fileURLToPath(new URL('./src/layout', import.meta.url)),
      '@diagram-adapter': fileURLToPath(new URL('./src/diagram-adapter', import.meta.url)),
      '@composition': fileURLToPath(new URL('./src/composition', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
});
