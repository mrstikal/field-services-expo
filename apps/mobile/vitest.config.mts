import { defineConfig } from 'vitest/config';
import path from 'path';

const isNativeTests = process.env.EXPO_NATIVE_TESTS === '1';

export default defineConfig({
  define: {
    __DEV__: 'false',
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve(__dirname, '.')}/` },
      { find: /^@lib\//, replacement: `${path.resolve(__dirname, './lib')}/` },
      {
        find: /^@shared\//,
        replacement: `${path.resolve(__dirname, '../../packages/shared-types')}/`,
      },
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
  },
  ssr: {
    noExternal: [
      'react-native',
      'react-native-web',
      '@testing-library/react-native',
      '@testing-library/react',
      '@expo/vector-icons',
      'react-test-renderer',
    ],
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
            '**/lib/db/__tests__/conversation-repository.test.ts',
            '**/lib/db/__tests__/db-integration.test.ts',
            '**/lib/db/__tests__/message-repository.test.ts',
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
          /react-native$/,
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
