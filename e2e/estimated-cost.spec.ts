// e2e of plan-session_usage, batch estimated-cost. The tests write the transcripts and subagent files that Claude Code would write.
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
const COST_TOOLTIP = 'Estimated cost at API list prices';
const INCOMPLETE = 'Incomplete: the price of a model is unknown';

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-cost-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of cleanup.splice(0)) {
    process?.kill('SIGKILL');
    for (const file of files) await rm(file, { recursive: true, force: true });
  }
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const percent = (target: Locator) => target.locator('.session-entry-context');
/** The amount in a list entry: the element with the estimate tooltip. */
const amount = (target: Locator) => target.getByTitle(COST_TOOLTIP, { exact: true });
const mark = (target: Locator) => target.getByRole('img', { name: INCOMPLETE });
const footer = (page: Page) => page.locator('.session-footer');
const costChip = (page: Page) => footer(page).locator('.session-figure-cost');
const tokensChip = (page: Page) => footer(page).locator('.session-figure-tokens');

let nextKey = 0;
interface Counts {
  input: number;
  output: number;
  cacheWrite?: number;
  cacheRead?: number;
  /** usage.cache_creation, the split of the cache write by duration. */
  creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number };
}
/** One transcript line of a response of `model`. */
const response = (model: string, counts: Counts, options: { sidechain?: boolean } = {}) => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: crypto.randomUUID(),
    isSidechain: options.sidechain ?? false,
    message: {
      id: `msg_e2e_cost_${nextKey}_${Date.now()}`,
      model,
      role: 'assistant',
      content: [{ type: 'text', text: 'Done.' }],
      usage: {
        input_tokens: counts.input,
        output_tokens: counts.output,
        cache_creation_input_tokens: counts.cacheWrite ?? 0,
        cache_read_input_tokens: counts.cacheRead ?? 0,
        ...(counts.creation ? { cache_creation: counts.creation } : {}),
      },
    },
  };
};
const userText = (text: string) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });

async function newFolder(name: string): Promise<string> {
  return mkdtemp(path.join(projectsRoot, `${name}-`));
}

type Writer = (...entries: object[]) => Promise<void>;

/** Appends lines to the main transcript of a Claude Code session; `subagent(name)` appends to one of its subagent files. */
async function transcript(folder: string, claudeSessionId: string): Promise<{ write: Writer; subagent: (name: string) => Writer }> {
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  const subagents = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  await mkdir(path.dirname(file), { recursive: true });
  cleanup.push({ files: [file, path.dirname(subagents)] });
  const common = { cwd: folder, sessionId: claudeSessionId };
  const writerOf = (target: string): Writer => async (...entries) => {
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, entries.map((e) => `${JSON.stringify({ ...common, ...e })}\n`).join(''));
  };
  return { write: writerOf(file), subagent: (name) => writerOf(path.join(subagents, name)) };
}

/** A hosted session whose hooks sent `claudeSessionId`, idle after its first turn. */
async function startHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const started = await request.post('/api/sessions', { data: { path: folder } });
  expect(started.status()).toBe(201);
  const { id } = (await started.json()) as { id: string };
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
  const files = await transcript(folder, claudeSessionId);
  if (entries.length > 0) await files.write(userText('Explain the code'), ...entries);
  const id = await startHosted(request, folder, claudeSessionId);
  return { id, folder, ...files };
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

// Expected amounts use the price-list spec table. claude-opus-5-5 and claude-sonnet-5-5 have a 1M window: 50,000 used tokens read "5%".
test.describe('Estimated cost', () => {
  // plan-session_usage/REQ-22, REQ-23, REQ-24, REQ-25, REQ-29, REQ-32, REQ-35, plan-session_list_width/REQ-20 — every session shows its estimated cost
  test('hosted and external sessions show their cost in the entry and the footer, and update within 2 seconds', async ({ page, request }) => {
    const hosted = await hostedWith(request, 'hosted', response('claude-opus-5-5', { input: 50_000, output: 20_000 }));
    await hosted.subagent('agent-a1.jsonl')(response('claude-opus-5-5', { input: 10_000, output: 5_000 }, { sidechain: true }));
    const externalFolder = await newFolder('external');
    const externalId = crypto.randomUUID();
    const external = await transcript(externalFolder, externalId);
    await external.write(userText('Explain the code'), response('claude-sonnet-5-5', { input: 20_000, output: 10_000 }));
    await runInTerminal(externalId, externalFolder);

    await page.goto('/');
    const hostedRow = entry(page, hosted.folder);
    const externalRow = entry(page, externalFolder);
    await expect(percent(hostedRow)).toHaveText('5%');
    await expect(amount(hostedRow), '$0.60 main + $0.14 subagent').toHaveText('$0.74');
    await expect(amount(externalRow)).toHaveText('$0.14', SCAN);
    await expect(percent(externalRow)).toHaveText('2%');
    await expect(mark(hostedRow)).toHaveCount(0);
    for (const row of [hostedRow, externalRow]) {
      const percentBox = (await percent(row).boundingBox())!;
      const amountBox = (await amount(row).boundingBox())!;
      const timeBox = (await row.locator('.session-entry-time').boundingBox())!;
      expect(percentBox.x, 'percentage, then cost, then time').toBeLessThan(amountBox.x);
      expect(amountBox.x + amountBox.width).toBeLessThanOrEqual(timeBox.x + 0.5);
      expect(Math.abs(amountBox.y + amountBox.height / 2 - (percentBox.y + percentBox.height / 2)), 'on the same line').toBeLessThanOrEqual(2);
    }
    await expect(hostedRow).toContainText(/5%\s*·\s*\$0\.74/);

    await hostedRow.click();
    await expect(costChip(page)).toHaveText(/^\s*\$0\.74\s*$/);
    await expect(costChip(page).getByTitle(COST_TOOLTIP, { exact: true })).toHaveText('$0.74');
    await expect(costChip(page)).toBeVisible();

    await hosted.write(userText('And the tests?'), response('claude-opus-5-5', { input: 100_000, output: 10_000 }));
    await expect(amount(hostedRow), '+$0.60').toHaveText('$1.34', WITHIN_2_S);
    await expect(costChip(page)).toHaveText(/^\s*\$1\.34\s*$/);
    await external.write(userText('And now?'), response('claude-sonnet-5-5', { input: 40_000, output: 20_000 }));
    await expect(amount(externalRow), '+$0.28').toHaveText('$0.42', WITHIN_2_S);

    await externalRow.click();
    await expect(costChip(page)).toHaveText(/^\s*\$0\.42\s*$/);
  });

  // plan-session_usage/REQ-26, REQ-27, REQ-28 — scenario "Cache and tiered prices"
  test('prices 1-hour cache, cache with no duration and a long Haiku 5.5 prompt', async ({ page, request }) => {
    const { folder } = await hostedWith(
      request,
      'cache',
      response('claude-opus-5-5', { input: 0, output: 0, cacheWrite: 100_000, creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 100_000 } }),
      response('claude-opus-5-5', { input: 0, output: 0, cacheWrite: 100_000 }),
      response('claude-haiku-5-5', { input: 150_000, output: 10_000 }),
    );
    await page.goto('/');
    await expect(amount(entry(page, folder)), '1h $0.80 + 5m $0.50 + long Haiku $0.10').toHaveText('$1.40');
    await entry(page, folder).click();
    await expect(costChip(page)).toHaveText(/^\s*\$1\.40\s*$/);
  });

  // plan-session_usage/REQ-30, REQ-31 — scenario "A model with no known price"
  test('a model with no known price marks the cost incomplete and still counts in the tokens', async ({ page, request }) => {
    const { folder } = await hostedWith(
      request,
      'unknown',
      response('claude-opus-5-5', { input: 50_000, output: 20_000 }),
      response('claude-unknown-9', { input: 1_000, output: 1_000 }),
    );
    await page.goto('/');
    const amber = await colourOf(page, '--amber-400');
    const row = entry(page, folder);
    await expect(amount(row)).toHaveText('$0.60');
    await expect(mark(row)).toHaveText('*');
    await expect(mark(row)).toHaveAttribute('title', INCOMPLETE);
    await expect(mark(row)).toHaveCSS('color', amber);

    await row.click();
    await expect(costChip(page)).toHaveText(/^\s*\$0\.60\s*incomplete\s*$/);
    await expect(mark(costChip(page))).toHaveText('incomplete');
    await expect(mark(costChip(page))).toHaveAttribute('title', INCOMPLETE);
    await expect(mark(costChip(page))).toHaveCSS('color', amber);
    await expect(tokensChip(page)).toHaveText(/^\s*72k tokens/);
  });

  // plan-session_usage/REQ-30 — scenario "Only unknown prices"
  test('only unknown prices show "—" with the incomplete mark', async ({ page, request }) => {
    const { folder } = await hostedWith(request, 'only-unknown', response('claude-unknown-9', { input: 1_000, output: 1_000 }));
    await page.goto('/');
    const row = entry(page, folder);
    await expect(amount(row)).toHaveText('—');
    await expect(mark(row)).toBeVisible();
    await row.click();
    await expect(costChip(page)).toHaveText(/^\s*—\s*incomplete\s*$/);
    await expect(mark(costChip(page))).toBeVisible();
  });

  // plan-session_usage/REQ-32, REQ-33, plan-session_list_width/REQ-26 — scenario "Small and missing costs"
  test('no cost before the first answer, and "<$0.01" for a tiny one', async ({ page, request }) => {
    const fresh = await hostedWith(request, 'fresh');
    const tiny = await hostedWith(request, 'tiny', response('claude-opus-5-5', { input: 100, output: 10 }));
    await page.goto('/');
    await expect(amount(entry(page, tiny.folder)), '100 × $4 + 10 × $20 = $0.0006').toHaveText('<$0.01');
    await page.waitForTimeout(1_500);
    await expect(amount(entry(page, fresh.folder))).toHaveCount(0);
    await expect(entry(page, fresh.folder)).not.toContainText('$');
    await entry(page, fresh.folder).click();
    await expect(footer(page)).toBeVisible();
    await expect(costChip(page)).toHaveCount(0);
    await expect(footer(page)).not.toContainText('$');
  });

  // plan-session_usage/REQ-34, plan-session_list_width/REQ-27 — scenario "An ended session keeps its cost"
  test('an ended session keeps its cost', async ({ page, request }) => {
    const { id, folder } = await hostedWith(request, 'ended', response('claude-opus-5-5', { input: 50_000, output: 32_500 }));
    await page.goto('/');
    await expect(amount(entry(page, folder)), '50,000 × $4 + 32,500 × $20').toHaveText('$0.85');
    await entry(page, folder).click();
    await expect(costChip(page)).toHaveText(/^\s*\$0\.85\s*$/);

    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    const endedGroup = list(page).locator('.session-group').filter({ has: page.locator('.session-group-ended') });
    const endedRow = endedGroup.locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
    await expect(endedRow).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await expect(amount(endedRow)).toHaveText('$0.85');
    await expect(costChip(page)).toHaveText(/^\s*\$0\.85\s*$/);
  });
});
