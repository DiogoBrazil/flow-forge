import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/unit/**/*.spec.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'integration-storage',
            environment: 'node',
            include: ['tests/integration/storage/**/*.spec.ts'],
            setupFiles: ['tests/setup/indexeddb.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'integration-diagram',
            environment: 'happy-dom',
            include: ['tests/integration/diagram/**/*.spec.ts'],
            setupFiles: ['tests/setup/vueflow.ts'],
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/domain/**', 'src/rules/**', 'src/application/**', 'src/schemas/**'],
        thresholds: {
          'src/domain/**': {
            lines: 90,
            functions: 90,
            branches: 85,
            statements: 90,
          },
          'src/rules/**': {
            lines: 90,
            functions: 90,
            branches: 85,
            statements: 90,
          },
        },
      },
    },
  }),
);
