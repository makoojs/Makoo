/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@rite/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@rite/vue': resolve(__dirname, 'packages/vue/src/index.ts'),
      '@rite/react': resolve(__dirname, 'packages/react/src/index.ts'),
      '@rite/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
    },
  },
  test: {
    silent: true,
    environment: 'jsdom',
    include: ['./packages/*/test/**/*.test.ts'],
  },
})
