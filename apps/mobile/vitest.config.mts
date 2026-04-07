import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
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
