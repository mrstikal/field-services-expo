import { defineConfig } from 'vitest/config';
import path from 'path';

const isNativeTests = process.env.EXPO_NATIVE_TESTS === '1';

export default defineConfig({
  define: {
    __DEV__: 'false',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@lib': path.resolve(__dirname, './lib'),
      '@shared': path.resolve(__dirname, '../../packages/shared-types'),
      'react-native': 'react-native-web',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Native runtime-dependent suites are excluded from default jsdom run.
      ...(!isNativeTests
        ? [
            '**/lib/db/__tests__/db-integration.test.ts',
            '**/__tests__/integration/sync-flow.test.ts',
            '**/__tests__/integration/sync-resilience.test.ts',
          ]
        : []),
    ],
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
    server: {
      deps: {
          inline: [
            /react-native-web/,
            /@testing-library\/.*/,
            /react-native-testing-library/,
            /@react-native-community\/netinfo/,
          /expo-.*/,
          /@expo\/.*/,
          /react-native-reanimated/,
          /react-test-renderer/,
        ],
      },
    },
  },
});
