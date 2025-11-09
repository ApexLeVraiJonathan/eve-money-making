import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@eve/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@eve/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@eve/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
    },
  },
});

