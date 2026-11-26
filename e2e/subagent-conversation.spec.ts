// e2e of plan-session_activity, batch subagent-conversation. The tests write the transcripts, subagent files and metadata that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Line = Record<string, unknown>;

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 20_000 };
// REQ-51 asks for 2 s: under the load of the complete run the e2e checks that it happens, not how fast (the unit tests time it).
const PROMPTLY = { timeout: 15_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-subagent-conversation-')));
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
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.main-view:not(.is-leaving) .session-header');
const turnButton = (page: Page) => header(page).getByRole('button', { name: 'Turn Panel', exact: true });
const panel = (page: Page) => mainArea(page).getByRole('region', { name: 'Turn Panel', exact: true });
const terminalPanel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const subConversation = (page: Page) => panel(page).getByRole('region', { name: 'Subagent Conversation', exact: true });
const openButton = (page: Page, type: string) => panel(page).getByRole('button', { name: `Open Conversation: ${type}`, exact: true });
const backButton = (page: Page) => subConversation(page).getByRole('button', { name: 'Back', exact: true });
const treeArea = (page: Page) => panel(page).locator('[tabindex="0"]');
const toolCard = (scope: Locator, name: string, text: string) => scope.locator(`[aria-label="Tool: ${name}"]`).filter({ hasText: text });

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();
const userText = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (content: string | object[], timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content },
});
const toolUse = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const agentUse = (id: string, description: string, type: string) => toolUse(id, 'Agent', { description, prompt: description, subagent_type: type });
const toolResult = (id: string, content: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
});
const lines = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix} line ${i + 1}`).join('\n');

const newFolder = (name: string) => mkdtemp(path.join(projectsRoot, `${name}-`));
const projectDir = (folder: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));

const writeLines = async (file: string, entries: Line[]) => {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, entries.map((line) => `${JSON.stringify(line)}\n`).join(''));
};

/** The files of one Claude Code session: its main transcript and its subagents, as Claude Code writes them. */
function claudeSession(folder: string, claudeSessionId: string) {
  const main = path.join(projectDir(folder), `${claudeSessionId}.jsonl`);
  cleanup.push({ files: [projectDir(folder)] });
  return {
    write: (...entries: Line[]) => writeLines(main, entries),
    subagent: (agentId: string) => {
      const file = path.join(projectDir(folder), claudeSessionId, 'subagents', `${agentId}.jsonl`);
      return {
        write: (...entries: Line[]) => writeLines(file, entries),
        meta: async (meta: object) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
  };
}

async function startWorkingHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  const hook = await request.post(`/api/sessions/${id}/hook-events`, { data: { hook_event_name: 'UserPromptSubmit', prompt: 'Do the work', session_id: claudeSessionId } });
  expect(hook.status()).toBe(204);
  return id;
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

async function openSession(page: Page, folder: string, external = false): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await expect(entry(page, folder)).toBeVisible(external ? SCAN : undefined);
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText(path.basename(folder));
}

async function openPanel(page: Page): Promise<void> {
  await turnButton(page).click();
  await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page)).toBeVisible();
}

/** Whether the focused element, or the wrapper right around it (a tool card around its row), draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const ring = getComputedStyle(probe).color;
    probe.remove();
    const el = document.activeElement;
    if (!el) return false;
    return [el, el.parentElement].some((at) => {
      if (!at) return false;
      const s = getComputedStyle(at);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ring;
      return outline || s.boxShadow.includes(ring);
    });
  });
}

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? ''}` : '';
  });
const focusIn = (page: Page, selector: string) => page.evaluate((s) => document.activeElement?.closest(s) != null, selector);

/** The scrolling message area of a conversation region: its first descendant that scrolls vertically. */
const messageArea = (region: Locator) =>
  region.evaluate((root) => {
    const area = [...root.querySelectorAll<HTMLElement>('*')].find((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight);
    return area ? { atEnd: area.scrollTop + area.clientHeight >= area.scrollHeight - 8, scrolls: true } : { atEnd: true, scrolls: false };
  });

/** Font and colours of the deepest element that holds `text`. */
const lookOf = (scope: Locator, text: string) =>
  scope.getByText(text, { exact: false }).first().evaluate((el) => {
    const s = getComputedStyle(el);
    let fill = 'rgba(0, 0, 0, 0)';
    for (let at: Element | null = el; at && fill === 'rgba(0, 0, 0, 0)'; at = at.parentElement) fill = getComputedStyle(at).backgroundColor;
    return { fontFamily: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, fill };
  });

test.describe('Subagent conversation', () => {
  // plan-session_activity/REQ-49, REQ-50, REQ-51, REQ-53 — scenario "The user reads the live conversation of a subagent"
  test('a click on the card of a running subagent shows its conversation read-only, from its task to its latest step, live, with the terminal on screen', async ({ page, request }) => {
    const folder = await newFolder('live');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Date.now();
    await files.write(userText('Test the batch', iso(t0 - 60_000)), claudeSays([agentUse('tester', 'Run the tests of batch X', 'sdd-tester')], iso(t0 - 50_000)));
    const tester = files.subagent('agent-t1');
    await tester.write(
      userText('Run the tests of batch X', iso(t0 - 40_000), true),
      claudeSays('Reading the spec first', iso(t0 - 30_000), true),
      claudeSays([toolUse('b1', 'Bash', { command: 'npm test' })], iso(t0 - 20_000), true),
      toolResult('b1', 'all green', iso(t0 - 15_000), true),
      claudeSays('All tests pass so far', iso(t0 - 10_000), true),
    );
    await tester.meta({ agentType: 'sdd-tester', description: 'Run the tests of batch X', toolUseId: 'tester' });

    await openSession(page, folder);
    await expect(terminalPanel(page)).toBeVisible();
    await openPanel(page);
    await expect(openButton(page, 'sdd-tester')).toBeVisible(PROMPTLY);
    await openButton(page, 'sdd-tester').click();

    const view = subConversation(page);
    await expect(view).toBeVisible();
    await expect(backButton(page)).toBeVisible();
    await expect(view.getByText('sdd-tester', { exact: true })).toBeVisible();
    await expect(view.getByTitle('Run the tests of batch X', { exact: true }).first()).toBeVisible();
    await expect(view.getByText('Running', { exact: true })).toBeVisible();
    const task = view.getByRole('article', { name: 'Task', exact: true });
    await expect(task).toHaveCount(1, PROMPTLY);
    await expect(task).toContainText('Run the tests of batch X');
    await expect(task.getByText('T', { exact: true })).toBeVisible();
    await expect(view.getByRole('article', { name: 'Claude', exact: true }).first()).toContainText('Reading the spec first');
    const bash = toolCard(view, 'Bash', 'npm test');
    await expect(bash).toBeVisible();
    await expect(bash).toContainText('Completed');
    const labels = await view.locator('article').evaluateAll((els) => els.map((el) => `${el.getAttribute('aria-label')}: ${el.textContent}`));
    expect(labels[0], 'the task first').toMatch(/^Task: .*Run the tests of batch X/);
    expect(labels.at(-1), 'the latest step last').toContain('All tests pass so far');
    await expect(view.locator('input, textarea, [contenteditable="true"]'), 'read-only').toHaveCount(0);

    await expect(header(page).getByRole('heading', { level: 2 }), 'REQ-53: the session stays open').toHaveText(path.basename(folder));
    await expect(terminalPanel(page), 'REQ-53: the terminal stays on screen').toBeVisible();
    await expect(panel(page).getByText('Current Turn', { exact: true })).toBeVisible();
    await expect(openButton(page, 'sdd-tester'), 'the tree is hidden').toBeHidden();

    await tester.write(claudeSays('A new step of the tester', iso(Date.now()), true));
    await expect(view.getByText('A new step of the tester', { exact: true }), 'REQ-51: the new step shows').toBeVisible(PROMPTLY);
  });

  // plan-session_activity/REQ-52 — scenario "The conversation of an ended subagent"
  test('the conversation of a finished and of a stopped subagent opens, with its last step at the end', async ({ page }) => {
    const folder = await newFolder('ended');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Explore twice', iso(t0 - 120_000)),
      claudeSays([agentUse('done', 'Finished exploration', 'Explore'), agentUse('cut', 'Stopped exploration', 'Explore')], iso(t0 - 110_000)),
    );
    const done = files.subagent('agent-done');
    await done.write(
      userText('Finished exploration', iso(t0 - 100_000), true),
      ...Array.from({ length: 40 }, (_, i) => claudeSays(`Finished step ${i}`, iso(t0 - 90_000 + i * 100), true)),
      claudeSays('The exploration is complete', iso(t0 - 60_000), true),
    );
    await done.meta({ agentType: 'Explore', description: 'Finished exploration', toolUseId: 'done', finished: true });
    const cut = files.subagent('agent-cut');
    await cut.write(
      userText('Stopped exploration', iso(t0 - 100_000), true),
      ...Array.from({ length: 40 }, (_, i) => claudeSays(`Stopped step ${i}`, iso(t0 - 90_000 + i * 100), true)),
      claudeSays('Halfway through the stopped one', iso(t0 - 70_000), true),
      userText('[Request interrupted by user]', iso(t0 - 65_000), true),
    );
    await cut.meta({ agentType: 'Explore', description: 'Stopped exploration', toolUseId: 'cut' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);

    for (const [description, pill, last] of [
      ['Finished exploration', 'Finished', 'The exploration is complete'],
      ['Stopped exploration', 'Stopped', '[Request interrupted by user]'],
    ] as const) {
      const card = panel(page).getByRole('article').filter({ hasText: description });
      await expect(card.getByText(pill, { exact: true })).toBeVisible(PROMPTLY);
      await card.getByRole('button', { name: 'Open Conversation: Explore', exact: true }).click();
      const view = subConversation(page);
      await expect(view.getByText(pill, { exact: true })).toBeVisible();
      await expect(view.getByRole('article', { name: 'Task', exact: true }).first()).toContainText(description, PROMPTLY);
      await expect(view.locator('article').last(), `${description}: the last step at the end`).toContainText(last);
      await expect(view.locator('article').last()).toBeInViewport();
      await expect.poll(async () => (await messageArea(view)).scrolls, `${description}: the messages scroll`).toBe(true);
      await expect.poll(async () => (await messageArea(view)).atEnd, `${description}: shown at the end`).toBe(true);
      await backButton(page).click();
      await expect(view).toHaveCount(0);
    }
  });

  // plan-session_activity/REQ-54 — scenario "One action returns to the tree"
  test('"Back" shows the tree again at the same scroll place, with the focus on the card', async ({ page }) => {
    const folder = await newFolder('back');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Go', iso(t0 - 20_000)),
      ...Array.from({ length: 120 }, (_, i) => claudeSays(`Before ${i}`, iso(t0 - 19_000 + i))),
      claudeSays([agentUse('mid', 'Middle task', 'Explore')], iso(t0 - 18_000)),
      ...Array.from({ length: 120 }, (_, i) => claudeSays(`After ${i}`, iso(t0 - 17_000 + i))),
    );
    const sub = files.subagent('agent-mid');
    await sub.write(userText('Middle task', iso(t0 - 16_000), true), claudeSays('Exploring the middle', iso(t0 - 15_000), true));
    await sub.meta({ agentType: 'Explore', description: 'Middle task', toolUseId: 'mid' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    await expect(panel(page).getByText('After 119', { exact: true })).toBeVisible(PROMPTLY);

    const opener = openButton(page, 'Explore');
    await opener.scrollIntoViewIfNeeded();
    await expect(opener).toBeInViewport();
    const place = await treeArea(page).evaluate((el) => ({ top: el.scrollTop, atEnd: el.scrollTop + el.clientHeight >= el.scrollHeight - 8 }));
    expect(place.atEnd, 'the tree is scrolled away from its end').toBe(false);
    expect(place.top).toBeGreaterThan(0);

    await opener.click();
    await expect(subConversation(page)).toBeVisible();
    await expect(subConversation(page).getByText('Exploring the middle', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('After 119', { exact: true }), 'the tree is hidden').toBeHidden();

    await backButton(page).click();
    await expect(subConversation(page)).toHaveCount(0);
    await expect(opener).toBeVisible();
    await expect(opener).toBeFocused();
    await expect.poll(() => treeArea(page).evaluate((el) => el.scrollTop), 'the same scroll place').toBeCloseTo(place.top, 0);
  });

  // plan-session_activity/REQ-50 — scenario "The full content of a tool card", compared with the conversation of the external session
  test('a tool result cut to 5 lines opens to its full output, with the look of the conversation of an external session', async ({ page }) => {
    const folder = await newFolder('full');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Read the logs', iso(t0 - 60_000)),
      claudeSays([toolUse('main-cat', 'Bash', { command: 'cat session.log' })], iso(t0 - 55_000)),
      toolResult('main-cat', lines('session', 8), iso(t0 - 54_000)),
      claudeSays([agentUse('reader', 'Read the subagent log', 'Explore')], iso(t0 - 50_000)),
    );
    const sub = files.subagent('agent-reader');
    await sub.write(
      userText('Read the subagent log', iso(t0 - 40_000), true),
      claudeSays([toolUse('sub-cat', 'Bash', { command: 'cat subagent.log' })], iso(t0 - 30_000), true),
      toolResult('sub-cat', lines('subagent', 8), iso(t0 - 29_000), true),
    );
    await sub.meta({ agentType: 'Explore', description: 'Read the subagent log', toolUseId: 'reader' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);

    const sessionCard = toolCard(mainArea(page), 'Bash', 'cat session.log');
    await expect(sessionCard).toBeVisible();
    await sessionCard.getByRole('button').first().click();
    await expect(sessionCard.getByText('session line 8')).toBeVisible(PROMPTLY);

    await openPanel(page);
    await openButton(page, 'Explore').click();
    const view = subConversation(page);
    const subCard = toolCard(view, 'Bash', 'cat subagent.log');
    await expect(subCard).toBeVisible(PROMPTLY);
    await expect(subCard).toContainText('Completed');
    await expect(subCard.getByText(/subagent line 1/), 'closed by default').toHaveCount(0);
    await subCard.getByRole('button').first().click();
    await expect(subCard.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
    await expect(subCard.getByText(/subagent line 8/), 'the full output').toBeVisible(PROMPTLY);
    await expect(subCard.getByText(/subagent line 6/)).toBeVisible();

    expect(await lookOf(subCard, 'subagent line 8'), 'the output block looks the same').toEqual(await lookOf(sessionCard, 'session line 8'));
    expect(await lookOf(view.getByRole('article', { name: 'Task', exact: true }), 'Read the subagent log'), 'the user box looks the same').toEqual(
      await lookOf(page.locator('.conversation-view').getByRole('article', { name: 'You', exact: true }), 'Read the logs'),
    );
  });

  // plan-session_activity/REQ-55 — scenario "The conversation works with the keyboard"
  test('Tab reaches the card, Enter and Space open the conversation, Esc closes it, and each focused element shows the focus ring', async ({ page }) => {
    const folder = await newFolder('keyboard');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(userText('Go', iso(t0 - 20_000)), claudeSays([agentUse('k', 'Keyboard task', 'Explore')], iso(t0 - 15_000)));
    const sub = files.subagent('agent-k');
    await sub.write(
      userText('Keyboard task', iso(t0 - 10_000), true),
      claudeSays([toolUse('k1', 'Bash', { command: 'ls' })], iso(t0 - 9_000), true),
      toolResult('k1', 'README.md', iso(t0 - 8_000), true),
      claudeSays([toolUse('k2', 'Read', { file_path: 'README.md' })], iso(t0 - 7_000), true),
    );
    await sub.meta({ agentType: 'Explore', description: 'Keyboard task', toolUseId: 'k' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    const opener = openButton(page, 'Explore');
    await expect(opener).toBeVisible(PROMPTLY);

    await turnButton(page).focus();
    for (let i = 0; i < 100 && !(await opener.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
    await expect(opener, 'reached with Tab').toBeFocused();
    expect(await focusedShowsRing(page), 'the card shows the focus ring').toBe(true);

    await page.keyboard.press('Enter');
    await expect(subConversation(page)).toBeVisible();
    await expect(backButton(page)).toBeFocused();
    await expect(toolCard(subConversation(page), 'Read', 'README.md')).toBeVisible(PROMPTLY);
    const reached: string[] = [];
    for (let i = 0; i < 10 && (await focusIn(page, 'section[aria-label="Subagent Conversation"]')); i += 1) {
      const name = await focusedName(page);
      reached.push(name);
      expect(await focusedShowsRing(page), `${name} shows the focus ring`).toBe(true);
      await page.keyboard.press('Tab');
    }
    expect(reached[0]).toBe('BUTTON Back');
    expect(reached.length, `Back and the tool card rows: ${reached.join(' | ')}`).toBeGreaterThanOrEqual(3);

    await backButton(page).focus();
    await page.keyboard.press('Escape');
    await expect(subConversation(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await focusedShowsRing(page), 'the card shows the focus ring again').toBe(true);

    await page.keyboard.press('Space');
    await expect(subConversation(page)).toBeVisible();
    await expect(backButton(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(subConversation(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  // conversation-body spec, seen in a subagent conversation: a socket closed before the first frame shows the error
  test('says "Conversation not available." when the conversation of the subagent cannot be read', async ({ page }) => {
    const folder = await newFolder('error');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(userText('Go', iso(t0 - 20_000)), claudeSays([agentUse('gone', 'Gone task', 'Explore')], iso(t0 - 15_000)));
    const sub = files.subagent('agent-gone');
    await sub.write(userText('Gone task', iso(t0 - 10_000), true));
    await sub.meta({ agentType: 'Explore', description: 'Gone task', toolUseId: 'gone' });
    await page.routeWebSocket(/\/api\/sessions\/[^/]+\/subagents\/[^/]+\/conversation$/, (ws) => void ws.close({ code: 4404 }));
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    await openButton(page, 'Explore').click();
    await expect(subConversation(page).getByText('Conversation not available.', { exact: true })).toBeVisible();
    await expect(backButton(page)).toBeVisible();
  });
});

test.describe('Subagent routes on the server', () => {
  // server spec: the routes are registered, and LocalAccessGuard covers them
  test('the item route answers for an unknown session, and refuses another local origin', async ({ request }) => {
    const items = '/api/sessions/no-such-session/subagents/agent-x/items?offset=0&block=0';
    const own = await request.get(items);
    expect(own.status()).toBe(404);
    expect(await own.json()).toEqual({ error: 'session_not_found' });
    const foreign = await request.get(items, { headers: { Origin: 'http://127.0.0.1:9' } });
    expect(foreign.status()).toBe(403);
  });
});
