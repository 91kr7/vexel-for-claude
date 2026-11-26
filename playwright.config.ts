import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './e2e/claude-dir';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
// These specs share the server's fixture Claude Code folder, so they must never run at the same time.
const claudeDirSpecs = /(resume-session|dismiss-resume|ended-external-sessions|history-search|external-sessions|session-entries|open-session-external|dialogs|desktop-bridge-external|running-tool|latest-text|stall-signal|turn-panel|rename|context-occupancy|tokens-consumed|estimated-cost|header-footer|navigation-shortcuts-external|session-action-shortcuts-resume|git-explorer|git-explorer-transitions|session-switch-transitions|favorite-session|project-list|project-session-start|favorite-project|remove-project|project-search|project-row|shared-shapes|window-frame|session-cards|list-cards|list-polish|popup-size|popup-mark|favorites-filter|project-path)\.spec\.ts$/;
// Specs that launch Electron open windows on the user's display: only `npm run test:e2e:desktop` runs them (E2E_DESKTOP=1).
const electronSpecs = /desktop-(window|notifications|tray|links|font-zoom|file-drop|list-width|reconnection|shortcuts|git-explorer-window|sound|terminal-width|remote-settings|remote-notification|turn-panel-window)\.spec\.ts$/;
const electron = process.env.E2E_DESKTOP === '1';
// No e2e server asks GitHub for releases: port 9 refuses, unless a spec points this at a fake source.
const releaseSource = (process.env.AI_CLIENT_RELEASE_SOURCE_URL ??= 'http://127.0.0.1:9/releases/latest');
// The launcher marker (`<pid>:<startTicks>` of this runner) lets the app mark a server left by a stopped run as hanging.
const runnerStat = readFileSync(`/proc/${process.pid}/stat`, 'utf8');
const launcherMarker = `${process.pid}:${runnerStat.slice(runnerStat.lastIndexOf(')') + 2).split(' ')[19]}`;
// The specs of earlier plans were written for a client that started dark: the browser runs as a user who chose dark.
// e2e/remembered-theme.spec.ts and e2e/dark-blue-theme.spec.ts clear this choice to test the first-start theme.
const darkChoice = { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'ai-client.theme', value: 'dark' }] }] };

export default defineConfig({
  testDir: './e2e',
  // At most 3 browsers at once: a full run must leave the machine usable (knowledge base `limited-test-parallelism`).
  workers: 3,
  // Generous limits: a complete run keeps the machine busy (3 browsers, the fake CLI and its hooks), and the page and the
  // server answer late at times. A wait ends as soon as its condition holds, so a passing run is not slower for it.
  timeout: 120_000,
  expect: { timeout: 15_000 },
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
      AI_CLIENT_RELEASE_SOURCE_URL: releaseSource,
      AI_CLIENT_LAUNCHER: launcherMarker,
      AI_CLIENT_TEST_SERVER: '1',
    },
    reuseExistingServer: !process.env.CI,
  },
});
