// e2e of plan-session_activity (batch turn-panel) and plan-subagent_panel. The tests write the transcripts, subagent files and metadata that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { expectJoined, expectNoMark, expectNoSideways, expectOneBelowTheOther, expectRowPlace } from './subagent-rows';

type Line = Record<string, unknown>;

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 20_000 };
// REQ-43 asks for 2 s: under the load of the complete run the e2e checks that it happens, not how fast (the unit tests time it).
const PROMPTLY = { timeout: 15_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-turn-panel-')));
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
const explorerButton = (page: Page) => header(page).getByRole('button', { name: 'Git Explorer', exact: true });
const panel = (page: Page) => mainArea(page).getByRole('region', { name: 'Turn Panel', exact: true });
const explorer = (page: Page) => mainArea(page).getByRole('region', { name: 'Git Explorer', exact: true });
const terminalPanel = (page: Page) => mainArea(page).getByRole('region', { name: /^Terminal/ });
const conversation = (page: Page) => page.locator('.conversation-view');
const cards = (scope: Locator, type?: string) => scope.getByRole('article', type === undefined ? undefined : { name: `Subagent: ${type}`, exact: true });
const treeArea = (page: Page) => panel(page).locator('[tabindex="0"]');
const noSubagents = (page: Page) => panel(page).getByText('No subagents in this turn.', { exact: true });
const subConversation = (page: Page) => panel(page).getByRole('region', { name: 'Subagent Conversation', exact: true });
const earlierSection = (page: Page) => panel(page).locator('section').filter({ hasText: 'Still running from earlier turns' });
const row = (scope: Locator, type: string, description: string) => cards(scope, type).filter({ has: scope.page().getByText(description, { exact: true }) });

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();
const userText = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (content: string | object[], timestamp: string, sidechain = false, model?: string): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', ...(model !== undefined && { model }), content: typeof content === 'string' ? [{ type: 'text', text: content }] : content },
});
const toolUse = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
/** The line as Claude Code writes it: each block of one assistant message on its own line, all with the message id. */
const inMessage = (id: string, line: Line): Line => ({ ...line, message: { ...(line.message as object), id } });
const agentUse = (id: string, description: string, type: string) => toolUse(id, 'Agent', { description, prompt: 'Do the work', subagent_type: type });
const toolResult = (id: string, timestamp: string, sidechain = false): Line => ({
  type: 'user',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'done' }] },
});

const newFolder = (name: string) => mkdtemp(path.join(projectsRoot, `${name}-`));
const projectDir = (folder: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));

const writeLines = async (file: string, lines: Line[]) => {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
};

/** The files of one Claude Code session: its main transcript and its subagents, as Claude Code writes them. */
function claudeSession(folder: string, claudeSessionId: string) {
  const main = path.join(projectDir(folder), `${claudeSessionId}.jsonl`);
  cleanup.push({ files: [projectDir(folder)] });
  return {
    write: (...lines: Line[]) => writeLines(main, lines),
    subagent: (agentId: string) => {
      const file = path.join(projectDir(folder), claudeSessionId, 'subagents', `${agentId}.jsonl`);
      return {
        write: (...lines: Line[]) => writeLines(file, lines),
        meta: async (meta: object) => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file.replace(/\.jsonl$/, '.meta.json'), JSON.stringify(meta));
        },
      };
    },
  };
}

const git = (folder: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder, encoding: 'utf8' }).trim();

/** A repository on `main` with one commit. */
async function newRepository(name: string): Promise<string> {
  const root = path.join(await newFolder('r'), name);
  await mkdir(root);
  git(root, 'init', '-q', '-b', 'main');
  await writeFile(path.join(root, 'README.md'), 'hello\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'first');
  return root;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

async function startHosted(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function startWorkingHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const id = await startHosted(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Do the work', session_id: claudeSessionId });
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
  await expect(panel(page).getByText('Current Turn', { exact: true })).toBeVisible();
}

/** Waits for the effects that end (panel slide, list cascade): a box read while one plays sits where the effect has moved it. */
const effectsDone = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

async function box(locator: Locator) {
  await effectsDone(locator.page());
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
async function focusedShowsRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const ring = getComputedStyle(probe).color;
    probe.remove();
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ring;
    return outline || s.boxShadow.includes(ring);
  });
}

const focusInPanel = (page: Page) => page.evaluate(() => document.activeElement?.closest('section[aria-label="Turn Panel"]') !== null && document.activeElement !== null);
const atEnd = (area: Locator) => area.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
/** The scroll position once a smooth wheel scroll has come to rest: two reads 250 ms apart agree. */
async function restingScrollTop(area: Locator): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const previous = last;
        last = await area.evaluate((el) => el.scrollTop);
        return last === previous;
      },
      { message: 'the scroll comes to rest', intervals: [250] },
    )
    .toBe(true);
  return last;
}
/** Whether the whole box of `target` shows inside the scrolling area, within 1 px. */
async function wholeInArea(area: Locator, target: Locator): Promise<boolean> {
  const [view, box] = [await area.boundingBox(), await target.boundingBox()];
  return view !== null && box !== null && box.y >= view.y - 1 && box.y + box.height <= view.y + view.height + 1;
}

test.describe('Turn panel', () => {
  // plan-subagent_panel/REQ-1, REQ-2, REQ-3, REQ-8, REQ-10, REQ-12, plan-session_activity/REQ-27, REQ-32 to REQ-37, REQ-43 — scenarios "The panel shows
  // only the subagents of the turn, in start order", "The subagents show as a list, with a group joined on the left", "A row shows the same fields as the card"
  test('shows only the subagents of the turn as rows: the analyst, then the two developers of one message joined by a line', async ({ page, request }) => {
    const folder = await newFolder('follow');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await page.clock.setFixedTime(t0);
    await files.write(
      userText('Implement the batch', iso(t0 - 90_000)),
      inMessage('msg_text', claudeSays('I will check the **repository** first', iso(t0 - 85_000))),
      inMessage('msg_git', claudeSays([toolUse('git', 'Bash', { command: 'git status' })], iso(t0 - 80_000))),
      toolResult('git', iso(t0 - 79_000)),
      inMessage('msg_analyst', claudeSays([agentUse('analyst', 'Analyse the request', 'sdd-analyst')], iso(t0 - 75_000))),
      toolResult('analyst', iso(t0 - 50_000)),
      inMessage('msg_developers', claudeSays([agentUse('dev-1', 'Implement INT-1', 'sdd-developer')], iso(t0 - 40_000))),
      inMessage('msg_developers', claudeSays([agentUse('dev-2', 'Implement INT-2', 'sdd-developer')], iso(t0 - 40_000))),
    );
    const analyst = files.subagent('agent-an');
    await analyst.write(userText('Analyse the request', iso(t0 - 70_000), true), claudeSays('The request is clear', iso(t0 - 55_000), true));
    await analyst.meta({ agentType: 'sdd-analyst', description: 'Analyse the request', toolUseId: 'analyst' });
    for (const [agent, call, task, model] of [
      ['agent-d1', 'dev-1', 'Implement INT-1', 'claude-opus-5-5'],
      ['agent-d2', 'dev-2', 'Implement INT-2', 'claude-sonnet-5'],
    ] as const) {
      const sub = files.subagent(agent);
      await sub.write(
        userText(task, iso(t0 - 30_000), true),
        claudeSays(`Reading the **spec** of ${task}`, iso(t0 - 20_000), true, model),
        claudeSays([toolUse(`${agent}-test`, 'Bash', { command: 'npm test' })], iso(t0 - 10_000), true, model),
      );
      await sub.meta({ agentType: 'sdd-developer', description: task, toolUseId: call, pickedEffortModel: model });
    }
    await openSession(page, folder);
    await expect(panel(page), 'the panel is closed when the view opens').toHaveCount(0);
    await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'false');
    await openPanel(page);

    await expect(panel(page).getByText('Running', { exact: true }).first()).toBeVisible();
    const analystCard = cards(panel(page), 'sdd-analyst');
    const developers = cards(panel(page), 'sdd-developer');
    await expect(analystCard).toBeVisible(PROMPTLY);
    await expect(developers).toHaveCount(2, PROMPTLY);
    for (const [index, task, model] of [
      [0, 'Implement INT-1', 'claude-opus-5-5'],
      [1, 'Implement INT-2', 'claude-sonnet-5'],
    ] as const) {
      const card = developers.nth(index);
      await expect(card.getByText(task, { exact: true })).toBeVisible();
      await expect(card.getByText(model, { exact: true })).toBeVisible();
      await expect(card.getByText('Running', { exact: true })).toBeVisible();
      await expect(card.getByText(`Reading the spec of ${task}`, { exact: true })).toBeVisible();
      await expect(card).toContainText('Bash: npm test');
      await expect(card.locator('time')).toHaveText('30 s');
    }
    for (const text of ['Implement the batch', 'I will check the repository first', 'git status']) {
      await expect(panel(page), `no message of the main conversation: ${text}`).not.toContainText(text);
    }
    await expect(panel(page).getByRole('listitem')).toHaveCount(0);

    const area = treeArea(page);
    const rows = [analystCard, developers.nth(0), developers.nth(1)];
    await expectOneBelowTheOther(rows);
    for (const [i, each] of rows.entries()) await expectRowPlace(area, each, 0, `row ${i}`);
    await expectJoined(area, [developers.nth(0), developers.nth(1)]);
    await expectNoMark(area, analystCard, 'the sdd-analyst row');

    await page.clock.setFixedTime(t0 + 12_000);
    await expect(developers.nth(0).locator('time'), 'the duration counts up').toHaveText('42 s');

    await files.write(claudeSays('Both developers are at work', iso(t0)));
    await files.subagent('agent-d1').write(claudeSays('The tests pass', iso(t0), true, 'claude-opus-5-5'));
    await expect(developers.nth(0).getByText('The tests pass', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page)).not.toContainText('Both developers are at work');

    await turnButton(page).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  // plan-subagent_panel/REQ-5, REQ-6 — scenario "A turn with no subagents"
  test('says "No subagents in this turn." under "Ended" when the last turn ended with no subagent', async ({ page, request }) => {
    const folder = await newFolder('no-subagents');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Date.now();
    await files.write(userText('What does the parser do?', iso(t0 - 10_000)), claudeSays('It reads the transcript lines', iso(t0 - 5_000)));
    await postHook(request, id, { hook_event_name: 'Stop' });
    await openSession(page, folder);
    await openPanel(page);
    await expect(noSubagents(page)).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('Ended', { exact: true })).toBeVisible();
    await expect(panel(page).getByText('No turn yet.', { exact: true })).toHaveCount(0);
    await expect(cards(panel(page))).toHaveCount(0);
    await expect(panel(page)).not.toContainText('It reads the transcript lines');
    await expect(panel(page)).not.toContainText('What does the parser do?');
    const [chip, message] = [await box(panel(page).getByText('Ended', { exact: true })), await box(noSubagents(page))];
    expect(message.y, 'the message under the "Ended" mark').toBeGreaterThan(chip.y);
  });

  // plan-session_activity/REQ-27 — scenario "The panel takes the place of the git explorer", external session
  test('takes the place of the git explorer at the right of the conversation, and the git explorer takes its place back', async ({ page }) => {
    const repo = await newRepository('external-repo');
    const sessionId = uuid();
    const files = claudeSession(repo, sessionId);
    const t0 = Date.now();
    await files.write(userText('Explain the code', iso(t0 - 5_000)), claudeSays('The module has three parts', iso(t0 - 4_000)));
    await runInTerminal(sessionId, repo);
    await openSession(page, repo, true);
    await expect(conversation(page)).toContainText('The module has three parts');
    const names = await header(page)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
    const resume = names.findIndex((name) => name.includes('Resume Here'));
    expect(names.indexOf('Git Explorer'), names.join(' | ')).toBe(names.indexOf('Turn Panel') - 1);
    expect(names.indexOf('Turn Panel'), 'before Resume Here').toBe(resume - 1);

    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await openPanel(page);
    await expect(explorer(page), 'one side panel at a time').toHaveCount(0);
    await expect(explorerButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(noSubagents(page)).toBeVisible(PROMPTLY);
    await expect(panel(page)).not.toContainText('The module has three parts');
    const panelBox = await box(panel(page));
    const content = await box(conversation(page).locator('.conversation-items'));
    expect(panelBox.x, 'at the right of the conversation').toBeGreaterThanOrEqual(content.x + content.width - 1);

    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  // plan-session_activity/REQ-27, REQ-48 — scenario "The panel takes the place of the git explorer", hosted session
  test('takes the place of the git explorer beside the terminal of a hosted session, and the terminal fits the width left', async ({ page, request }) => {
    const repo = await newRepository('hosted-repo');
    const claudeSessionId = uuid();
    const files = claudeSession(repo, claudeSessionId);
    await startWorkingHosted(request, repo, claudeSessionId);
    await files.write(userText('Go', iso(Date.now() - 2_000)), claudeSays('Working in the repository', iso(Date.now())));
    await openSession(page, repo);
    const names = await header(page)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
    expect(names.slice(0, 3), 'Git Explorer, Turn Panel, Search').toEqual(['Git Explorer', 'Turn Panel', 'Search']);
    const full = await box(terminalPanel(page));

    await explorerButton(page).click();
    await expect(explorer(page)).toBeVisible();
    await openPanel(page);
    await expect(explorer(page)).toHaveCount(0);
    await expect(noSubagents(page)).toBeVisible(PROMPTLY);
    await expect(panel(page)).not.toContainText('Working in the repository');
    const [terminalBox, panelBox] = [await box(terminalPanel(page)), await box(panel(page))];
    expect(terminalBox.width, 'the terminal panel is narrower').toBeLessThan(full.width - 100);
    expect(panelBox.x, 'the panel at the right of the terminal').toBeGreaterThanOrEqual(terminalBox.x + terminalBox.width - 1);
    const xterm = await box(terminalPanel(page).locator('.xterm-screen'));
    expect(xterm.x + xterm.width, 'the terminal fits the width left').toBeLessThanOrEqual(terminalBox.x + terminalBox.width);

    await turnButton(page).click();
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(async () => (await box(terminalPanel(page))).width, 'the terminal takes the full width again').toBeGreaterThan(full.width - 2);
  });

  // turn-panel spec, "Motion": it slides in from the right edge; leaving, it is hidden and lets the pointer through
  test('slides in from the right edge, and while it slides out it is no longer exposed and takes no pointer input', async ({ page }) => {
    const SLOW_MS = 1500;
    const folder = await newFolder('slide');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    await files.write(userText('Go', iso(Date.now() - 2_000)), claudeSays('Sliding text', iso(Date.now())));
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await page.evaluate((ms) => {
      document.documentElement.style.setProperty('--motion-duration-enter', `${ms}ms`);
      document.documentElement.style.setProperty('--motion-duration-exit', `${ms}ms`);
      const store = window as unknown as { __lefts: number[] };
      store.__lefts = [];
      const tick = () => {
        const section = document.querySelector('section[aria-label="Turn Panel"]');
        if (section) store.__lefts.push(section.getBoundingClientRect().left);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, SLOW_MS);
    const sections = page.locator('section[aria-label="Turn Panel"]');

    await turnButton(page).click();
    await expect(panel(page)).toBeVisible();
    await effectsDone(page);
    const lefts = await page.evaluate(() => (window as unknown as { __lefts: number[] }).__lefts);
    const settled = (await box(panel(page))).x;
    expect(lefts.length, 'frames of the opening slide').toBeGreaterThan(5);
    expect(lefts[0]!, 'it starts at the right edge').toBeGreaterThan(settled + 100);
    for (let i = 1; i < lefts.length; i += 1) expect(lefts[i]!, 'it moves left, never back').toBeLessThanOrEqual(lefts[i - 1]! + 1);

    await turnButton(page).click();
    await expect(panel(page), 'closed: no longer exposed').toHaveCount(0);
    await expect(sections, 'the panel plays its exit').toHaveCount(1);
    await expect(sections).toHaveAttribute('aria-hidden', 'true');
    const throughPointer = await sections.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return top === null || !element.contains(top);
    });
    expect(throughPointer, 'the leaving panel takes no pointer input').toBe(true);
    await expect(sections).toHaveCount(0);
  });

  // plan-session_activity/REQ-38, plan-subagent_panel/REQ-9 — scenario "A nested subagent appears under its parent"
  test('shows a subagent started by a subagent under the row of its parent, one level further right', async ({ page }) => {
    const folder = await newFolder('nested');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(userText('Go', iso(t0 - 10_000)), claudeSays([agentUse('parent-call', 'Parent task', 'sdd-developer')], iso(t0 - 9_000)));
    const parent = files.subagent('agent-p');
    await parent.write(userText('Parent task', iso(t0 - 8_000), true), claudeSays('Delegating the search', iso(t0 - 7_000), true));
    await parent.meta({ agentType: 'sdd-developer', description: 'Parent task', toolUseId: 'parent-call' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    const parentCard = cards(panel(page), 'sdd-developer');
    await expect(parentCard).toHaveCount(1, PROMPTLY);

    const child = files.subagent('agent-c');
    await parent.write(claudeSays([agentUse('child-call', 'Find the callers', 'Explore')], iso(Date.now()), true));
    await child.write(userText('Find the callers', iso(Date.now()), true));
    await child.meta({ agentType: 'Explore', description: 'Find the callers', toolUseId: 'child-call' });
    const childRow = cards(panel(page), 'Explore');
    await expect(childRow).toBeVisible(PROMPTLY);
    await expect(childRow.getByText('Find the callers', { exact: true })).toBeVisible();
    await expect(cards(parentCard, 'Explore'), 'not inside the row of its parent').toHaveCount(0);
    await expectOneBelowTheOther([parentCard, childRow]);
    await expectRowPlace(treeArea(page), parentCard, 0, 'the parent row');
    await expectRowPlace(treeArea(page), childRow, 1, 'the nested row');
  });

  // plan-session_activity/REQ-33, REQ-34 — scenario "An interrupt stops the subagents"
  test('shows an interrupted subagent as "Stopped", with its duration fixed at its full run time', async ({ page }) => {
    const folder = await newFolder('interrupt');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(userText('Go', iso(t0 - 60_000)), claudeSays([agentUse('x', 'Long task', 'sdd-tester')], iso(t0 - 50_000)));
    const sub = files.subagent('agent-x');
    await sub.write(userText('Long task', iso(t0 - 40_000), true), claudeSays('Running the suite', iso(t0 - 35_000), true));
    await sub.meta({ agentType: 'sdd-tester', toolUseId: 'x' });
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await openSession(page, folder, true);
    await openPanel(page);
    const card = cards(panel(page), 'sdd-tester');
    await expect(card.getByText('Running', { exact: true })).toBeVisible(PROMPTLY);
    await expect(card.locator('time')).toHaveText('40 s');

    await sub.write(userText('[Request interrupted by user]', iso(t0 - 30_000), true));
    await expect(card.getByText('Stopped', { exact: true })).toBeVisible(PROMPTLY);
    await expect(card).toContainText('10 s');
    await page.clock.setFixedTime(t0 + 30_000);
    await expect(card, 'the duration no longer counts').toContainText('10 s');
    await expect(card).not.toContainText('70 s');
  });

  // plan-session_activity/REQ-39, REQ-40, plan-subagent_panel/REQ-5, REQ-6 — scenario "A background subagent outlives its turn"
  test('keeps a background subagent in "Still running from earlier turns" in the next turn, and marks the idle turn "Ended"', async ({ page, request }) => {
    const folder = await newFolder('background');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Date.now();
    await files.write(
      userText('Start the tests in the background', iso(t0 - 20_000)),
      claudeSays([agentUse('bg', 'Background tests', 'sdd-tester')], iso(t0 - 19_000)),
      toolResult('bg', iso(t0 - 18_000)),
      claudeSays('The tests run in the background', iso(t0 - 17_000)),
    );
    const background = files.subagent('agent-bg');
    await background.write(userText('Run the tests', iso(t0 - 18_000), true), claudeSays('Running the suite', iso(t0 - 10_000), true));
    await background.meta({ agentType: 'sdd-tester', description: 'Background tests', toolUseId: 'bg' });
    await openSession(page, folder);
    await openPanel(page);
    await expect(cards(panel(page), 'sdd-tester')).toBeVisible(PROMPTLY);

    await postHook(request, id, { hook_event_name: 'Stop' });
    await expect(panel(page).getByText('Ended', { exact: true })).toBeVisible(PROMPTLY);
    await expect(cards(panel(page), 'sdd-tester').getByText('Running', { exact: true }), 'the subagent still runs').toBeVisible();

    await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'And now?', session_id: claudeSessionId });
    await files.write(userText('And now?', iso(Date.now())), claudeSays('The tests still run', iso(Date.now())));
    await expect(noSubagents(page), 'the new turn has no subagent of its own').toBeVisible(PROMPTLY);
    const earlier = panel(page).locator('section').filter({ hasText: 'Still running from earlier turns' });
    await expect(cards(earlier, 'sdd-tester')).toBeVisible();
    const [section, message] = [await box(earlier), await box(noSubagents(page))];
    expect(message.y, 'the message under the section of earlier turns').toBeGreaterThanOrEqual(section.y + section.height - 1);
    await expect(panel(page).getByText('Ended', { exact: true })).toHaveCount(0);
    await expect(panel(page)).not.toContainText('The tests still run');
    await expect(panel(page)).not.toContainText('The tests run in the background');

    await postHook(request, id, { hook_event_name: 'Stop' });
    await expect(panel(page).getByText('Ended', { exact: true })).toBeVisible(PROMPTLY);
    await expect(noSubagents(page), 'the last turn stays shown').toBeVisible();
    await expect(cards(earlier, 'sdd-tester')).toBeVisible();
  });

  // plan-session_activity/REQ-41, plan-subagent_panel/REQ-7 — scenario "A session with no turn"
  test('says "No turn yet." for a new hosted session with no message', async ({ page, request }) => {
    const folder = await newFolder('no-turn');
    await startHosted(request, folder);
    await openSession(page, folder);
    await openPanel(page);
    await expect(panel(page).getByText('No turn yet.', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('Running', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByText('Ended', { exact: true })).toHaveCount(0);
  });

  // plan-subagent_panel/REQ-4 — scenario "The panel follows the latest subagent"
  test('follows the row of the latest started subagent until the user scrolls up, then stays still', async ({ page }) => {
    const folder = await newFolder('scroll');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    const type = (i: number) => `worker-${String(i).padStart(2, '0')}`;
    const startWorker = async (i: number, at: number) => {
      await files.write(claudeSays(`Starting worker ${i}`, iso(at - 2)), claudeSays([agentUse(`call-${i}`, `Worker task ${i}`, type(i))], iso(at - 1)));
      const sub = files.subagent(`agent-w${i}`);
      await sub.write(userText(`Worker task ${i}`, iso(at), true), claudeSays(`Worker ${i} ${'reads the code '.repeat(8)}`, iso(at), true));
      await sub.meta({ agentType: type(i), description: `Worker task ${i}`, toolUseId: `call-${i}` });
    };
    await files.write(userText('Go', iso(t0 - 120_000)));
    for (let i = 0; i < 15; i += 1) await startWorker(i, t0 - 100_000 + i * 1_000);
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    const area = treeArea(page);
    await expect(cards(panel(page))).toHaveCount(15, PROMPTLY);
    await expect.poll(() => wholeInArea(area, cards(panel(page), type(14))), 'the view shows the latest card at first').toBe(true);
    await expect(cards(panel(page), type(0)), 'more cards than fit').not.toBeInViewport();

    await startWorker(15, Date.now());
    await expect(cards(panel(page), type(15))).toBeAttached(PROMPTLY);
    await expect.poll(() => wholeInArea(area, cards(panel(page), type(15))), 'the view follows the new subagent').toBe(true);

    await area.hover();
    await page.mouse.wheel(0, -1500);
    await expect.poll(() => atEnd(area), 'scrolled up').toBe(false);
    const scrolled = await restingScrollTop(area);
    await startWorker(16, Date.now());
    await expect(cards(panel(page), type(16))).toBeAttached(PROMPTLY);
    expect(await area.evaluate((el) => el.scrollTop), 'the view stays still').toBe(scrolled);
    await expect(cards(panel(page), type(16))).not.toBeInViewport();

    await area.hover();
    await page.mouse.wheel(0, 5_000);
    await expect.poll(() => atEnd(area), 'back at the end').toBe(true);
    const parent = files.subagent('agent-w0');
    const child = files.subagent('agent-nested');
    await parent.write(claudeSays([agentUse('nested-call', 'Find the callers', 'Explore')], iso(Date.now()), true));
    await child.write(userText('Find the callers', iso(Date.now()), true));
    await child.meta({ agentType: 'Explore', description: 'Find the callers', toolUseId: 'nested-call' });
    const nested = cards(panel(page), 'Explore');
    await expect(nested).toBeAttached(PROMPTLY);
    await expect.poll(() => wholeInArea(area, nested), 'following again, the view goes to a nested subagent that started last').toBe(true);
  });

  // plan-session_activity/REQ-45, REQ-46, plan-subagent_panel/REQ-8, REQ-10 — scenario "A large turn stays usable"
  test('shows 20 subagents of one message as rows joined by one line, one of them running for 16 hours, and none of the thousands of steps', async ({ page }) => {
    const folder = await newFolder('large');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const steps = Array.from({ length: 3_000 }, (_, i) => claudeSays(`Step ${String(i).padStart(4, '0')}`, iso(t0 - 17 * 3_600_000 + i)));
    const calls = Array.from({ length: 20 }, (_, i) => agentUse(`call-${i}`, `Worker task ${i}`, `worker-${String(i).padStart(2, '0')}`));
    await files.write(userText('Go', iso(t0 - 17 * 3_600_000 - 1_000)), ...steps, claudeSays(calls, iso(t0 - 16 * 3_600_000 - 1_000)));
    for (let i = 0; i < 20; i += 1) {
      const sub = files.subagent(`agent-w${i}`);
      const started = i === 0 ? t0 - 16 * 3_600_000 : t0 - 60_000;
      const lines = [userText(`Worker task ${i}`, iso(started), true), claudeSays(`Worker ${i} at work`, iso(t0 - 1_000), true)];
      if (i === 0) for (let n = 0; n < 2_000; n += 1) lines.push(claudeSays([toolUse(`w0-${n}`, 'Bash', { command: `step ${n}` })], iso(started + n), true), toolResult(`w0-${n}`, iso(started + n), true));
      await sub.write(...lines);
      await sub.meta({ agentType: `worker-${String(i).padStart(2, '0')}`, description: `Worker task ${i}`, toolUseId: `call-${i}` });
    }
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await openSession(page, folder, true);
    await openPanel(page);

    const workers = cards(panel(page));
    await expect(workers).toHaveCount(20, PROMPTLY);
    await expect(cards(panel(page), 'worker-00').locator('time')).toHaveText('16 h 00 min');
    await expect(panel(page).getByText(/^Step \d{4}$/), 'plan-subagent_panel/REQ-1: no step of the main conversation').toHaveCount(0);
    await expect(panel(page).getByRole('button', { name: /earlier step/ })).toHaveCount(0);

    const rows = await workers.all();
    await expectOneBelowTheOther(rows);
    for (const [i, each] of rows.entries()) await expectRowPlace(treeArea(page), each, 0, `row ${i}`);
    await expectJoined(treeArea(page), rows);
  });

  // plan-session_activity/REQ-44 — scenario "Missing data hides only its field"
  test('shows the other fields of a subagent with no description and no model', async ({ page }) => {
    const folder = await newFolder('missing');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(userText('Go', iso(t0 - 10_000)), claudeSays([agentUse('x', 'Ignored here', 'Explore')], iso(t0 - 9_000)));
    const sub = files.subagent('agent-x');
    await sub.write(userText('Task', iso(t0 - 8_000), true), claudeSays('Searching the callers', iso(t0 - 7_000), true));
    await sub.meta({ agentType: 'Explore', toolUseId: 'x' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    const card = cards(panel(page), 'Explore');
    await expect(card).toBeVisible(PROMPTLY);
    await expect(card.getByText('Running', { exact: true })).toBeVisible();
    await expect(card.getByText('Searching the callers', { exact: true })).toBeVisible();
    await expect(card.locator('time')).toBeVisible();
    await expect(card).not.toContainText('claude-');
    await expect(card).not.toContainText('Ignored here');
    await expect(card).not.toContainText('undefined');
  });

  // plan-session_activity/REQ-47 — scenario "The panel works with the keyboard and in the desktop window", browser page
  test('opens from the keyboard and shows the focus ring on each focused element of the panel', async ({ page }) => {
    const folder = await newFolder('keyboard');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Go', iso(t0 - 10_000)),
      ...Array.from({ length: 250 }, (_, i) => claudeSays(`Step ${i}`, iso(t0 - 9_000 + i))),
      claudeSays([agentUse('x', 'Keyboard task', 'Explore')], iso(t0 - 5_000)),
    );
    const sub = files.subagent('agent-x');
    await sub.write(userText('Task', iso(t0 - 4_000), true));
    await sub.meta({ agentType: 'Explore', toolUseId: 'x' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await expect(conversation(page)).toContainText('Step 249');

    await header(page).locator('.mono-chip').first().focus();
    for (let i = 0; i < 10 && !(await turnButton(page).evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
    await expect(turnButton(page), 'reached with Tab').toBeFocused();
    expect(await focusedShowsRing(page), '"Turn Panel" shows the focus ring').toBe(true);
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(cards(panel(page), 'Explore')).toBeVisible(PROMPTLY);

    for (let i = 0; i < 400 && !(await focusInPanel(page)); i += 1) await page.keyboard.press('Tab');
    expect(await focusInPanel(page), 'reached the panel with Tab').toBe(true);
    const reached: string[] = [];
    for (let i = 0; i < 10 && (await focusInPanel(page)); i += 1) {
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 30) ?? ''}`;
      });
      reached.push(name);
      expect(await focusedShowsRing(page), `${name} shows the focus ring`).toBe(true);
      await page.keyboard.press('Tab');
    }
    expect(reached.some((name) => name.startsWith('BUTTON Open Conversation: Explore')), reached.join(' | ')).toBe(true);
    expect(reached.some((name) => name.startsWith('DIV')), `the tree area takes the focus: ${reached.join(' | ')}`).toBe(true);
  });
});

test.describe('Turn panel, subagents as a list', () => {
  // plan-subagent_panel/REQ-9, REQ-10, REQ-11, plan-session_activity/REQ-49 — scenarios "A nested subagent shows indented under its parent",
  // "A click on a row opens the subagent conversation"
  test('shows the subagent nested under the first member of a group between the two members, with no tick, and a click on its row opens its conversation', async ({ page }) => {
    const folder = await newFolder('nested-group');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Implement the batch', iso(t0 - 90_000)),
      inMessage('msg_developers', claudeSays([agentUse('dev-1', 'Implement INT-1', 'sdd-developer')], iso(t0 - 80_000))),
      inMessage('msg_developers', claudeSays([agentUse('dev-2', 'Implement INT-2', 'sdd-developer')], iso(t0 - 80_000))),
    );
    const first = files.subagent('agent-d1');
    await first.write(
      userText('Implement INT-1', iso(t0 - 70_000), true),
      claudeSays('Delegating the tests', iso(t0 - 60_000), true),
      inMessage('msg_d1_tester', claudeSays([agentUse('tester-call', 'Test INT-1', 'sdd-tester')], iso(t0 - 55_000), true)),
    );
    await first.meta({ agentType: 'sdd-developer', description: 'Implement INT-1', toolUseId: 'dev-1' });
    const second = files.subagent('agent-d2');
    await second.write(userText('Implement INT-2', iso(t0 - 69_000), true), claudeSays('Reading the spec', iso(t0 - 50_000), true));
    await second.meta({ agentType: 'sdd-developer', description: 'Implement INT-2', toolUseId: 'dev-2' });
    const tester = files.subagent('agent-t');
    await tester.write(userText('Test INT-1', iso(t0 - 50_000), true), claudeSays('Running the suite', iso(t0 - 40_000), true));
    await tester.meta({ agentType: 'sdd-tester', description: 'Test INT-1', toolUseId: 'tester-call' });
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);

    const [dev1, dev2, testerRow] = [row(panel(page), 'sdd-developer', 'Implement INT-1'), row(panel(page), 'sdd-developer', 'Implement INT-2'), cards(panel(page), 'sdd-tester')];
    await expect(testerRow).toBeVisible(PROMPTLY);
    await expect(dev1).toBeVisible();
    await expect(dev2).toBeVisible();
    const area = treeArea(page);
    await expectOneBelowTheOther([dev1, testerRow, dev2]);
    await expectRowPlace(area, dev1, 0, 'the first sdd-developer row');
    await expectRowPlace(area, testerRow, 1, 'the sdd-tester row');
    await expectRowPlace(area, dev2, 0, 'the second sdd-developer row');
    await expectJoined(area, [dev1, dev2]);
    await expectNoMark(area, testerRow, 'the sdd-tester row');

    await testerRow.click();
    const view = subConversation(page);
    await expect(view).toBeVisible();
    await expect(view.getByText('sdd-tester', { exact: true })).toBeVisible();
    await expect(view.getByRole('article', { name: 'Task', exact: true })).toContainText('Test INT-1', PROMPTLY);
    await expect(view.getByText('Running the suite', { exact: true })).toBeVisible();
    await expect(view.getByText('sdd-developer', { exact: true }), 'not the conversation of its parent').toHaveCount(0);
  });

  // plan-subagent_panel/REQ-10, REQ-12 — scenario "A group still running from earlier turns stays joined"
  test('joins the two developers of one message of the previous turn under "Still running from earlier turns", and not the tester of another message', async ({ page }) => {
    const folder = await newFolder('earlier-group');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    await files.write(
      userText('Implement and test in the background', iso(t0 - 180_000)),
      inMessage('msg_developers', claudeSays([agentUse('dev-1', 'Implement INT-1', 'sdd-developer')], iso(t0 - 170_000))),
      inMessage('msg_developers', claudeSays([agentUse('dev-2', 'Implement INT-2', 'sdd-developer')], iso(t0 - 170_000))),
      toolResult('dev-1', iso(t0 - 169_000)),
      toolResult('dev-2', iso(t0 - 169_000)),
      inMessage('msg_tester', claudeSays([agentUse('tester-call', 'Test the batch', 'sdd-tester')], iso(t0 - 160_000))),
      toolResult('tester-call', iso(t0 - 159_000)),
      inMessage('msg_done', claudeSays('They all run in the background', iso(t0 - 150_000))),
      userText('And now?', iso(t0 - 10_000)),
      claudeSays('They still run', iso(t0 - 5_000)),
    );
    for (const [agent, call, type, task, start] of [
      ['agent-d1', 'dev-1', 'sdd-developer', 'Implement INT-1', 168_000],
      ['agent-d2', 'dev-2', 'sdd-developer', 'Implement INT-2', 167_000],
      ['agent-t', 'tester-call', 'sdd-tester', 'Test the batch', 158_000],
    ] as const) {
      const sub = files.subagent(agent);
      await sub.write(userText(task, iso(t0 - start), true), claudeSays(`Working on ${task}`, iso(t0 - 1_000), true));
      await sub.meta({ agentType: type, description: task, toolUseId: call });
    }
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);

    const earlier = earlierSection(page);
    const [dev1, dev2, testerRow] = [row(earlier, 'sdd-developer', 'Implement INT-1'), row(earlier, 'sdd-developer', 'Implement INT-2'), cards(earlier, 'sdd-tester')];
    await expect(cards(earlier)).toHaveCount(3, PROMPTLY);
    await expect(noSubagents(page), 'the new turn has no subagent of its own').toBeVisible();
    const area = treeArea(page);
    await expectOneBelowTheOther([dev1, dev2, testerRow]);
    for (const [i, each] of [dev1, dev2, testerRow].entries()) await expectRowPlace(area, each, 0, `row ${i}`);
    await expectJoined(area, [dev1, dev2]);
    await expectNoMark(area, testerRow, 'the sdd-tester row');
  });

  // plan-subagent_panel/REQ-8, REQ-9, REQ-13 — scenario "Three levels of nesting fit in the narrow panel"
  test('fits three levels of nesting in the panel at its smallest width: each level one gutter further right, every row to the right edge, no sideways scrolling', async ({ page }) => {
    const folder = await newFolder('narrow');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    const long = (what: string) => `${what} ${'with a long explanation of every detail '.repeat(4)}`.trim();
    const longPath = '/home/user/projects/a-very-long-project-folder-name/src/server/activity/an-even-longer-file-name-for-the-narrow-panel.ts';
    await files.write(
      userText('Implement the batch', iso(t0 - 90_000)),
      inMessage('msg_leads', claudeSays([agentUse('lead-call', long('Lead INT-1'), 'sdd-developer')], iso(t0 - 80_000))),
      inMessage('msg_leads', claudeSays([agentUse('peer-call', long('Lead INT-2'), 'sdd-developer')], iso(t0 - 80_000))),
    );
    const start = async (agent: string, call: string, type: string, task: string, ago: number, ...lines: Line[]) => {
      const sub = files.subagent(agent);
      await sub.write(userText(task, iso(t0 - ago), true), ...lines);
      await sub.meta({ agentType: type, description: task, toolUseId: call });
    };
    await start('agent-l0', 'lead-call', 'sdd-developer', long('Lead INT-1'), 70_000, claudeSays([agentUse('l1-call', long('Level one'), 'sdd-tester')], iso(t0 - 65_000), true));
    await start('agent-peer', 'peer-call', 'sdd-developer', long('Lead INT-2'), 69_000, claudeSays(long('Reading'), iso(t0 - 60_000), true));
    await start('agent-l1', 'l1-call', 'sdd-tester', long('Level one'), 60_000, claudeSays([agentUse('l2-call', long('Level two'), 'Explore')], iso(t0 - 55_000), true));
    await start('agent-l2', 'l2-call', 'Explore', long('Level two'), 50_000, claudeSays([agentUse('l3-call', long('Level three'), 'general-purpose')], iso(t0 - 45_000), true));
    await start(
      'agent-l3',
      'l3-call',
      'general-purpose',
      long('Level three'),
      40_000,
      claudeSays(`Reading ${longPath}`, iso(t0 - 35_000), true),
      claudeSays([toolUse('l3-bash', 'Bash', { command: `npm test -- ${longPath}` })], iso(t0 - 30_000), true),
    );
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await page.setViewportSize({ width: 900, height: 1000 });
    await openPanel(page);

    const levels = [row(panel(page), 'sdd-developer', long('Lead INT-1')), cards(panel(page), 'sdd-tester'), cards(panel(page), 'Explore'), cards(panel(page), 'general-purpose')];
    const peer = row(panel(page), 'sdd-developer', long('Lead INT-2'));
    await expect(levels[3]!).toBeVisible(PROMPTLY);
    await expect(levels[3]!).toContainText('Bash: npm test');
    expect(Math.abs((await box(panel(page))).width - 360), 'the panel at its smallest width').toBeLessThanOrEqual(1);

    const area = treeArea(page);
    await expectOneBelowTheOther([...levels, peer]);
    for (const [level, each] of levels.entries()) await expectRowPlace(area, each, level);
    await expectRowPlace(area, peer, 0, 'the second sdd-developer row');
    expect((await box(levels[3]!)).width, 'a row of level 3 keeps at least 240 px').toBeGreaterThanOrEqual(240);
    await expectJoined(area, [levels[0]!, peer]);
    await expectNoSideways(area, [...levels, peer]);
    expect(await panel(page).evaluate((el) => el.scrollWidth <= el.clientWidth), 'the panel has no horizontal scrollbar').toBe(true);
  });
});
