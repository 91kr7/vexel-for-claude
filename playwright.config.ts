import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './e2e/claude-dir';

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Not `npm start`: its fixed PORT would override the e2e port.
    command: 'npm run --silent build && NODE_ENV=production npx tsx src/server/main.ts',
    url: `${baseURL}/api/health`,
    // The fake CLI stands in for Claude Code: e2e tests never start the real one.
    env: {
      PORT: String(port),
      CLAUDE_CONFIG_DIR: E2E_CLAUDE_DIR,
      AI_CLIENT_CLAUDE_CLI: fileURLToPath(new URL('./test-support/fake-claude.mjs', import.meta.url)),
    },
    reuseExistingServer: !process.env.CI,
  },
});
