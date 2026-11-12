import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './e2e/claude-dir';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
// These specs share the server's fixture Claude Code folder, so they must never run at the same time.
const claudeDirSpecs = /(resume-session|dismiss-resume|history-search|external-sessions|session-entries|open-session-external|dialogs|desktop-bridge-external|running-tool|rename|context-occupancy|tokens-consumed|estimated-cost|header-footer|navigation-shortcuts-external|session-action-shortcuts-resume|git-explorer|favorite-session|project-list)\.spec\.ts$/;
// Specs that launch Electron open windows on the user's display: only `npm run test:e2e:desktop` runs them (E2E_DESKTOP=1).
const electronSpecs = /desktop-(window|notifications|tray|links|font-zoom|file-drop|list-width|reconnection|shortcuts|git-explorer-window)\.spec\.ts$/;
const electron = process.env.E2E_DESKTOP === '1';
// The specs of earlier plans were written for a client that started dark: the browser runs as a user who chose dark.
// e2e/remembered-theme.spec.ts clears this choice to test the light default.
const darkChoice = { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'ai-client.theme', value: 'dark' }] }] };

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  use: { baseURL },
  projects: electron
    ? [{ name: 'electron', use: { ...devices['Desktop Chrome'] }, testMatch: electronSpecs, workers: 1 }]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: darkChoice }, testIgnore: [claudeDirSpecs, electronSpecs] },
        { name: 'chromium-claude-dir', use: { ...devices['Desktop Chrome'], storageState: darkChoice }, testMatch: claudeDirSpecs, workers: 1 },
      ],
  webServer: {
    // Not `npm start`: its fixed PORT would override the e2e port.
    command: 'npm run --silent build && NODE_ENV=production npx tsx src/server/main.ts',
    url: `${baseURL}/api/health`,
    // The fake CLI stands in for Claude Code: e2e tests never start the real one.
    env: {
      PORT: String(port),
      CLAUDE_CONFIG_DIR: E2E_CLAUDE_DIR,
      // The session names of the e2e server, never the user's own.
      AI_CLIENT_DATA_DIR: path.join(os.tmpdir(), 'ai-client-e2e-data'),
      AI_CLIENT_CLAUDE_CLI: fileURLToPath(new URL('./test-support/fake-claude.mjs', import.meta.url)),
    },
    reuseExistingServer: !process.env.CI,
  },
});
