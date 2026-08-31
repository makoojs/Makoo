/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@makoojs/core': resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@makoojs/vue': resolve(import.meta.dirname, 'packages/vue/src/index.ts'),
      '@makoojs/react': resolve(import.meta.dirname, 'packages/react/src/index.ts'),
      '@makoojs/cli': resolve(import.meta.dirname, 'packages/cli/src/index.ts'),
    },
  },
  test: {
    silent: true,
    environment: 'jsdom',
    include: ['./packages/*/test/**/*.test.ts'],
    coverage: {
      exclude: ['**/dist/**', '**/test/**','.github'],
    },
  },
})
