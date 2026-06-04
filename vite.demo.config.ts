import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@makoo/core': resolve(__dirname, 'packages/core/src'),
      '@makoo/vue': resolve(__dirname, 'packages/vue/src'),
      '@makoo/react': resolve(__dirname, 'packages/react/src'),
    },
  },
  root: resolve(__dirname, 'demo'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'docs'),
    emptyOutDir: true
  }
})
