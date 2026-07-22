import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
      'client-only': fileURLToPath(new URL('./test/client-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
  },
})
