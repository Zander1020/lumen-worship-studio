import { defineConfig } from '@playwright/test'

delete process.env['ELECTRON_RUN_AS_NODE']

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list'
})
