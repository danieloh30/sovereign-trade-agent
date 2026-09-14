import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.DEMO_URL || 'http://localhost:8080', viewport: { width: 1440, height: 1000 } },
})
