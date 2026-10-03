import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  outputDir: 'test-results',
  reporter: 'list',
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: '.\\venv\\Scripts\\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'npm.cmd run dev -- --host 127.0.0.1',
      cwd: '../frontend',
      url: 'http://localhost:5173/',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
})
