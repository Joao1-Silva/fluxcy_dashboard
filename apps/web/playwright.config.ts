import { defineConfig, devices } from '@playwright/test';

const port = 3001;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port,
    reuseExistingServer: true,
    cwd: '.',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
