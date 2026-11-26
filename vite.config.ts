import { defineConfig } from 'vitest/config'

// VITE_BASE = "/<repo>/" no GitHub Pages; "/" em dev.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  test: { include: ['test/**/*.test.ts'] },
})
