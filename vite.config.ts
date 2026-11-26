import { defineConfig } from 'vitest/config'

// VITE_BASE = "/<repo>/" no GitHub Pages; "/" em dev. spike.html é o teste manual do login (fora do app).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: { rollupOptions: { input: { main: 'index.html', spike: 'spike.html' } } },
  test: { include: ['test/**/*.test.ts'] },
})
