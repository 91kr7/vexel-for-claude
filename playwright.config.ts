import { fileURLToPath } from 'node:url';
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
    // The fake CLI stands in for Claude Code: e2e tests never start the real one.
    env: { PORT: String(port), AI_CLIENT_CLAUDE_CLI: fileURLToPath(new URL('./test-support/fake-claude.mjs', import.meta.url)) },
    reuseExistingServer: !process.env.CI,
  },
});
