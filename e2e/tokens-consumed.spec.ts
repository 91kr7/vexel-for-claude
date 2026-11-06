// e2e of plan-session_usage, batch tokens-consumed. The tests write the main transcripts and subagent files that Claude Code would write.
import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const WITHIN_2_S = { timeout: 2_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: string[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-usage-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const file of cleanup.splice(0)) await rm(file, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const header = (page: Page) => page.locator('.session-header');
const chip = (page: Page) => header(page).locator('.session-header-tokens');
const popover = (page: Page) => page.getByRole('tooltip');
/** The chip text: the popover text sits inside the chip, so only the start is matched. */
const chipShows = (shown: string) => new RegExp(`^\\s*${shown.replace('.', '\\.')} tokens`);

let nextKey = 0;
interface Parts {
  input: number;
  output: number;
  cacheWrite?: number;
  cacheRead?: number;
}
/** One transcript line of a response; lines with the same `key` are content blocks of one response. */
const response = (parts: Parts, options: { key?: string; sidechain?: boolean } = {}) => {
  nextKey += 1;
  return {
    type: 'assistant',
    uuid: crypto.randomUUID(),
    isSidechain: options.sidechain ?? false,
    message: {
      id: options.key ?? `msg_e2e_tokens_${nextKey}`,
      model: 'claude-haiku-5-5',
      role: 'assistant',
      content: [{ type: 'text', text: 'Done.' }],
      usage: {
        input_tokens: parts.input,
        output_tokens: parts.output,
        cache_creation_input_tokens: parts.cacheWrite ?? 0,
        cache_read_input_tokens: parts.cacheRead ?? 0,
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
  cleanup.push(file, path.dirname(subagents));
  const common = { cwd: folder, sessionId: claudeSessionId };
  const writerOf = (target: string): Writer => async (...entries) => {
    await mkdir(path.dirname(target), { recursive: true });
    await appendFile(target, entries.map((e) => `${JSON.stringify({ ...common, ...e })}\n`).join(''));
  };
  return { write: writerOf(file), subagent: (name) => writerOf(path.join(subagents, name)) };
}

async function hookEvent(request: APIRequestContext, id: string, event: object): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

/** A hosted session whose hooks sent `claudeSessionId`, idle after its first turn. */
async function startHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  await hookEvent(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Explain the code', session_id: claudeSessionId });
  await hookEvent(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
  return id;
}

/** A hosted session with the given lines already in its transcript. */
async function hostedWith(request: APIRequestContext, name: string, ...entries: object[]) {
  const folder = await newFolder(name);
  const claudeSessionId = crypto.randomUUID();
  const files = await transcript(folder, claudeSessionId);
  await files.write(userText('Explain the code'), ...entries);
  const id = await startHosted(request, folder, claudeSessionId);
  return { id, folder, claudeSessionId, ...files };
}

test.describe('Tokens consumed', () => {
  // plan-session_usage/REQ-13, REQ-14, REQ-20 — scenario "The header shows the tokens of the session"
  test('the header shows the tokens of the session, subagent included, with the four parts on hover and focus', async ({ page, request }) => {
    const { folder, subagent } = await hostedWith(
      request,
      'header',
      response({ input: 1_000, output: 2_000, cacheWrite: 3_000, cacheRead: 4_000 }),
      userText('And the tests?'),
      response({ input: 500, output: 1_500, cacheWrite: 2_000, cacheRead: 6_000 }),
    );
    await subagent('agent-a1.jsonl')(response({ input: 100, output: 900, cacheWrite: 1_000, cacheRead: 2_000 }, { sidechain: true }));
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('24k'));
    await expect(chip(page)).toBeVisible();
    await expect(popover(page)).toBeHidden();
    await expect(entry(page, folder), 'the list entry shows no tokens').not.toContainText(/\d[kM]? tokens/);

    await chip(page).hover();
    await expect(popover(page)).toBeVisible();
    await expect(popover(page)).toHaveText(/^\s*Input\s*1\.6k\s*Output\s*4\.4k\s*Cache write\s*6k\s*Cache read\s*12k\s*$/);
    const popoverId = await popover(page).getAttribute('id');
    expect(popoverId).toBeTruthy();
    await expect(chip(page)).toHaveAttribute('aria-describedby', popoverId!);
    const headerBox = await header(page).boundingBox();
    expect(headerBox!.height, 'the header stays 40 px with the popover open').toBeLessThanOrEqual(40.5);
    const chipBox = await chip(page).boundingBox();
    const popoverBox = await popover(page).boundingBox();
    expect(popoverBox!.y, 'the popover sits under the chip').toBeGreaterThanOrEqual(chipBox!.y + chipBox!.height - 0.5);
    expect(Math.abs(popoverBox!.x + popoverBox!.width - (chipBox!.x + chipBox!.width)), 'aligned to the right edge of the chip').toBeLessThanOrEqual(1);

    await page.mouse.move(0, 0);
    await expect(popover(page)).toBeHidden();
    await chip(page).focus();
    await expect(popover(page)).toBeVisible();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect(popover(page)).toBeHidden();

    await subagent('agent-a1.jsonl')(response({ input: 200, output: 300, cacheWrite: 0, cacheRead: 500 }, { sidechain: true }));
    await expect(chip(page)).toHaveText(chipShows('25k'), WITHIN_2_S);
  });

  // plan-session_usage/REQ-15 — scenario "Repeated lines count once"
  test('a response written on several lines counts once with its final output', async ({ page, request }) => {
    const key = `msg_e2e_tokens_blocks_${Date.now()}`;
    const { folder } = await hostedWith(
      request,
      'blocks',
      response({ input: 1_000, output: 10, cacheRead: 2_000 }, { key }),
      response({ input: 1_000, output: 20, cacheRead: 2_000 }, { key }),
      response({ input: 1_000, output: 7_000, cacheRead: 2_000 }, { key }),
    );
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('10k'));
    await chip(page).hover();
    await expect(popover(page)).toHaveText(/Output\s*7k\s*Cache write/);
  });

  // plan-session_usage/REQ-16 — scenario "A resumed session keeps its old tokens"
  test('a resumed session keeps its old tokens', async ({ page, request }) => {
    const { id, folder, write } = await hostedWith(
      request,
      'resumed',
      response({ input: 1_000, output: 1_000, cacheWrite: 1_000, cacheRead: 2_000 }),
      response({ input: 400, output: 2_000, cacheWrite: 1_000, cacheRead: 4_000 }),
    );
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('12.4k'));
    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    await expect.poll(async () => ((await (await request.get('/api/sessions')).json()) as { id: string; state: string }[]).find((s) => s.id === id)?.state).toBe('ended');

    const resume = await request.post(`/api/sessions/${id}/resume`, { data: { force: true } });
    expect(resume.status()).toBe(201);
    const { id: resumedId } = (await resume.json()) as { id: string };
    createdIds.push(resumedId);
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('12.4k'));

    await write(userText('Go on'), response({ input: 100, output: 400, cacheWrite: 0, cacheRead: 500 }));
    await expect(chip(page)).toHaveText(chipShows('13.4k'), WITHIN_2_S);
  });

  // plan-session_usage/REQ-17, REQ-18 — scenario "`/clear` starts again from zero"
  test('/clear starts the tokens again from zero', async ({ page, request }) => {
    const { id, folder } = await hostedWith(request, 'clear', response({ input: 5_000, output: 10_000, cacheWrite: 10_000, cacheRead: 20_000 }));
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('45k'));

    const cleared = crypto.randomUUID();
    const after = await transcript(folder, cleared);
    await hookEvent(request, id, { hook_event_name: 'UserPromptSubmit', prompt: '/clear', session_id: cleared });
    await expect(chip(page)).toHaveCount(0, WITHIN_2_S);
    await expect(header(page)).not.toContainText(/\d[kM]? tokens/);

    await after.write(userText('Hello'), response({ input: 300, output: 700, cacheWrite: 500, cacheRead: 500 }));
    await expect(chip(page)).toHaveText(chipShows('2k'), WITHIN_2_S);
  });

  // plan-session_usage/REQ-18: before the first response there is no tokens chip, never "0 tokens"
  test('no tokens before the first response', async ({ page, request }) => {
    const { folder } = await hostedWith(request, 'fresh');
    await page.goto('/');
    await entry(page, folder).click();
    await expect(header(page)).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(chip(page)).toHaveCount(0);
    await expect(header(page)).not.toContainText(/\d[kM]? tokens/);
  });

  // plan-session_usage/REQ-19 — scenario "An ended session keeps its tokens"
  test('an ended session keeps its tokens', async ({ page, request }) => {
    const { id, folder } = await hostedWith(request, 'ended', response({ input: 5_000, output: 10_000, cacheWrite: 10_000, cacheRead: 20_000 }));
    await page.goto('/');
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('45k'));

    expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
    const endedGroup = list(page).locator('.session-group').filter({ has: page.locator('.session-group-ended') });
    await expect(endedGroup.locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await expect(chip(page)).toHaveText(chipShows('45k'));
  });

  // plan-session_usage/REQ-21 — scenario "A long session opens fast"
  test('a session with thousands of responses opens fast and shows its figures within a few seconds', async ({ page, request }) => {
    const other = await hostedWith(request, 'other', response({ input: 100, output: 200 }));
    const folder = await newFolder('long');
    const claudeSessionId = crypto.randomUUID();
    const { write, subagent } = await transcript(folder, claudeSessionId);
    const answers = 5_000;
    const lines = Array.from({ length: answers }, (_, n) => [userText(`Question ${n}`), response({ input: 10, output: 20, cacheWrite: 30, cacheRead: 40 })]).flat();
    await write(...lines);
    await subagent('agent-a1.jsonl')(...Array.from({ length: 1_000 }, () => response({ input: 1, output: 2, cacheWrite: 3, cacheRead: 4 }, { sidechain: true })));
    await startHosted(request, folder, claudeSessionId);

    await page.goto('/');
    const started = Date.now();
    await expect(entry(page, folder)).toBeVisible({ timeout: 5_000 });
    await entry(page, folder).click();
    await expect(header(page)).toContainText(path.basename(folder), { timeout: 2_000 });
    await entry(page, other.folder).click();
    await expect(header(page)).toContainText(path.basename(other.folder), { timeout: 2_000 });
    await entry(page, folder).click();
    await expect(chip(page)).toHaveText(chipShows('510k'), { timeout: 5_000 });
    expect(Date.now() - started, 'figures within a few seconds').toBeLessThan(8_000);
  });
});
