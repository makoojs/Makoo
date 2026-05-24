/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@makoo/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@makoo/vue': resolve(__dirname, 'packages/vue/src/index.ts'),
      '@makoo/react': resolve(__dirname, 'packages/react/src/index.ts'),
      '@makoo/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
      src: resolve(__dirname, 'packages/cli/src'),
    },
  },
  test: {
    silent: true,
    environment: 'jsdom',
    include: ['./packages/*/test/**/*.test.ts'],
  },
})
