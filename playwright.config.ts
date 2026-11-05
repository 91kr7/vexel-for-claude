import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run --silent build && npm run --silent start',
    url: `${baseURL}/api/health`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
});
