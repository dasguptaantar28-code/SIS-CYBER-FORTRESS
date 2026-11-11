import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sis/shared-contracts': path.resolve(__dirname, '../../packages/shared-contracts/src/index.ts'),
    },
  },
});
