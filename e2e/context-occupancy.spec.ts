// e2e of plan-session_usage, batch context-occupancy. The tests write the main transcripts that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const WITHIN_2_S = { timeout: 2_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-context-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of cleanup.splice(0)) {
    process?.kill('SIGKILL');
    for (const file of files) await rm(file, { force: true });
  }
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const percent = (target: Locator) => target.locator('.session-entry-context');
const chip = (page: Page) => page.locator('.session-header .session-header-context');
const chipValue = (page: Page) => chip(page).locator('span').last();

let nextKey = 0;
const response = (used: number, options: { model?: string; sidechain?: boolean } = {}) => {
  nextKey += 1;
  const cacheRead = Math.floor(used / 2);
  const cacheWrite = Math.floor(used / 4);
  return {
    type: 'assistant',
    uuid: crypto.randomUUID(),
    isSidechain: options.sidechain ?? false,
    message: {
      id: `msg_e2e_${nextKey}`,
      model: options.model ?? 'claude-haiku-5-5',
      role: 'assistant',
      content: [{ type: 'text', text: 'Done.' }],
      usage: { input_tokens: used - cacheRead - cacheWrite, output_tokens: 3_456, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead },
    },
  };
};
const userText = (text: string) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });
const compaction = { type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' };

async function newFolder(name: string): Promise<string> {
  return mkdtemp(path.join(projectsRoot, `${name}-`));
}

/** Appends lines to the main transcript of a Claude Code session, as Claude Code does while it works. */
async function transcript(folder: string, claudeSessionId: string): Promise<(...entries: object[]) => Promise<void>> {
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  cleanup.push({ files: [file] });
  return (...entries) => appendFile(file, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

/** A hosted session whose hooks sent `claudeSessionId`, idle after its first turn. */
async function startHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  for (const event of [{ hook_event_name: 'UserPromptSubmit', prompt: 'Explain the code' }, { hook_event_name: 'Stop' }]) {
    expect((await request.post(`/api/sessions/${id}/hook-events`, { data: { ...event, session_id: claudeSessionId } })).status()).toBe(204);
  }
  return id;
}

/** A hosted session with the given responses already in its transcript. */
async function hostedWith(request: APIRequestContext, name: string, ...entries: object[]) {
  const folder = await newFolder(name);
  const claudeSessionId = crypto.randomUUID();
  const write = await transcript(folder, claudeSessionId);
  if (entries.length > 0) await write(userText('Explain the code'), ...entries);
  const id = await startHosted(request, folder, claudeSessionId);
  return { id, folder, write };
}

/** Simulates Claude Code at work in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  cleanup.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'busy', updatedAt: Date.now() }));
}

/** The computed colour of a theme variable, e.g. `--amber-400`. */
const colourOf = (page: Page, variable: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, variable);

test.describe('Context occupancy', () => {
  // plan-session_usage/REQ-1, REQ-2, REQ-3, REQ-11: "23%" in the entry, "Context 45.2k / 200k · 23%" in the header
  test('a session shows how full its context is', async ({ page, request }) => {
    const { folder } = await hostedWith(request, 'shows', response(45_200));
    await page.goto('/');
    const row = entry(page, folder);
    await expect(percent(row)).toHaveText('23%');

    await row.click();
    await expect(chip(page)).toHaveText(/^Context\s*45\.2k \/ 200k · 23%$/);
    await expect(chip(page)).toBeVisible();
    const box = await row.boundingBox();
    expect(box!.height, 'a two-line row stays 48 px').toBeLessThanOrEqual(48.5);
  });

  // plan-session_usage/REQ-1, REQ-12: an external entry shows the new percentage within 2 seconds
  test('an external session updates in the list', async ({ page }) => {
    const folder = await newFolder('external');
    const sessionId = crypto.randomUUID();
    const write = await transcript(folder, sessionId);
    await write(userText('Explain the code'), response(20_000));
    await runInTerminal(sessionId, folder);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(percent(row)).toHaveText('10%', SCAN);

    await write(userText('And now?'), response(90_000));
    await expect(percent(row)).toHaveText('45%', WITHIN_2_S);
  });

  // plan-session_usage/REQ-8: amber from 70 %, rose from 90 %, in the entry and in the header
  test('a full context stands out', async ({ page, request }) => {
    const warning = await hostedWith(request, 'warning', response(150_000));
    const error = await hostedWith(request, 'error', response(184_000));
    await page.goto('/');
    const amber = await colourOf(page, '--amber-400');
    const rose = await colourOf(page, '--rose-400');
    expect(amber).not.toBe(rose);

    await expect(percent(entry(page, warning.folder))).toHaveText('75%');
    await expect(percent(entry(page, warning.folder))).toHaveCSS('color', amber);
    await expect(percent(entry(page, error.folder))).toHaveText('92%');
    await expect(percent(entry(page, error.folder))).toHaveCSS('color', rose);

    await entry(page, warning.folder).click();
    await expect(chipValue(page)).toHaveText('150k / 200k · 75%');
    await expect(chipValue(page)).toHaveCSS('color', amber);
    await entry(page, error.folder).click();
    await expect(chipValue(page)).toHaveText('184k / 200k · 92%');
    await expect(chipValue(page)).toHaveCSS('color', rose);
  });

  // plan-session_usage/REQ-4, REQ-5: above 200k used, and an extended-context model, use the 1M window
  test('a large context uses the large window', async ({ page, request }) => {
    const large = await hostedWith(request, 'large', response(300_000));
    const extended = await hostedWith(request, 'extended', response(150_000, { model: 'claude-haiku-5-5[1m]' }));
    await page.goto('/');
    await entry(page, large.folder).click();
    await expect(chip(page)).toHaveText(/^Context\s*300k \/ 1M · 30%$/);
    await entry(page, extended.folder).click();
    await expect(chip(page)).toHaveText(/^Context\s*150k \/ 1M · 15%$/);
  });

  // plan-session_usage/REQ-6, REQ-7, REQ-12: a subagent answer changes nothing; a compaction hides the chip until the next answer
  test('subagents and compaction', async ({ page, request }) => {
    const { folder, write } = await hostedWith(request, 'compact', response(80_000));
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(/^Context\s*80k \/ 200k · 40%$/);

    await write(response(5_000, { sidechain: true }));
    await page.waitForTimeout(2_000);
    await expect(chip(page)).toHaveText(/^Context\s*80k \/ 200k · 40%$/);
    await expect(percent(entry(page, folder))).toHaveText('40%');

    await write(compaction);
    await expect(chip(page)).toHaveCount(0, WITHIN_2_S);
    await expect(percent(entry(page, folder))).toHaveCount(0);

    await write(userText('Go on'), response(30_000));
    await expect(chip(page)).toHaveText(/^Context\s*30k \/ 200k · 15%$/, WITHIN_2_S);
  });

  // plan-session_usage/REQ-9: before the first response, no percentage and no "0%"
  test('no figures before the first response', async ({ page, request }) => {
    const { folder, write } = await hostedWith(request, 'fresh');
    await write(userText('Explain the code'));
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator('.session-header')).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(percent(row)).toHaveCount(0);
    await expect(chip(page)).toHaveCount(0);
    await expect(row).not.toContainText('0%');
    await expect(page.locator('.session-header')).not.toContainText('0%');
  });

  // plan-session_usage/REQ-10: an ended session keeps its last context occupancy, in the entry and in the header
  test('an ended session keeps its figures', async ({ page, request }) => {
    const { id, folder } = await hostedWith(request, 'ended', response(80_000));
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(/^Context\s*80k \/ 200k · 40%$/);

    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    const endedGroup = list(page).locator('.session-group').filter({ has: page.locator('.session-group-ended') });
    const endedRow = endedGroup.locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
    await expect(endedRow).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await expect(percent(endedRow)).toHaveText('40%');
    await expect(chip(page)).toHaveText(/^Context\s*80k \/ 200k · 40%$/);
  });
});
