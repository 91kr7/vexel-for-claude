// e2e of plan-session_activity, batch turn-panel. The tests write the transcripts, subagent files and metadata that Claude Code would write.
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
const stepRow = (page: Page, text: string) => panel(page).getByRole('listitem').filter({ hasText: text }).last();

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

test.describe('Turn panel', () => {
  // plan-session_activity/REQ-27 to REQ-37, REQ-43 — scenario "The user follows the turn and its subagents"
  test('shows the steps of the turn and two subagents of one message side by side, and a new step of Claude', async ({ page, request }) => {
    const folder = await newFolder('follow');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await page.clock.setFixedTime(t0);
    await files.write(
      userText('Implement the batch', iso(t0 - 60_000)),
      claudeSays('I will check the **repository** first', iso(t0 - 50_000)),
      claudeSays([toolUse('git', 'Bash', { command: 'git status' })], iso(t0 - 45_000)),
      toolResult('git', iso(t0 - 44_000)),
      claudeSays([agentUse('dev-1', 'Implement INT-1', 'sdd-developer'), agentUse('dev-2', 'Implement INT-2', 'sdd-developer')], iso(t0 - 40_000)),
    );
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
    await expect(panel(page).getByText('I will check the repository first', { exact: true })).toBeVisible(PROMPTLY);
    const bash = stepRow(page, 'git status');
    await expect(bash).toContainText('Bash');
    await expect(bash).toContainText('Completed');

    const developers = cards(panel(page), 'sdd-developer');
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
    const [first, second] = [await box(developers.nth(0)), await box(developers.nth(1))];
    expect(Math.abs(first.y - second.y), 'side by side, in one row').toBeLessThanOrEqual(1);
    expect(second.x, 'the second at the right of the first').toBeGreaterThan(first.x + first.width - 1);
    const lastCall = await box(stepRow(page, 'Implement INT-2'));
    expect(first.y, 'the group under the step that started it').toBeGreaterThanOrEqual(lastCall.y);

    await page.clock.setFixedTime(t0 + 12_000);
    await expect(developers.nth(0).locator('time'), 'the duration counts up').toHaveText('42 s');

    await files.write(claudeSays('Both developers are at work', iso(t0)));
    await expect(panel(page).getByText('Both developers are at work', { exact: true })).toBeVisible(PROMPTLY);

    await turnButton(page).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(turnButton(page)).toHaveAttribute('aria-expanded', 'false');
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
    await expect(panel(page).getByText('The module has three parts', { exact: true })).toBeVisible(PROMPTLY);
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
    await expect(panel(page).getByText('Working in the repository', { exact: true })).toBeVisible(PROMPTLY);
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

  // plan-session_activity/REQ-38 — scenario "A nested subagent appears under its parent"
  test('shows a subagent started by a subagent inside the card of its parent', async ({ page }) => {
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
    await expect(cards(parentCard, 'Explore')).toBeVisible(PROMPTLY);
    await expect(cards(parentCard, 'Explore').getByText('Find the callers', { exact: true })).toBeVisible();
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

  // plan-session_activity/REQ-39, REQ-40 — scenario "A background subagent outlives its turn"
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
    await expect(panel(page).getByText('The tests still run', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('The tests run in the background', { exact: true }), 'the steps of the earlier turn are gone').toHaveCount(0);
    const earlier = panel(page).locator('section').filter({ hasText: 'Still running from earlier turns' });
    await expect(cards(earlier, 'sdd-tester')).toBeVisible();
    await expect(panel(page).getByText('Ended', { exact: true })).toHaveCount(0);

    await postHook(request, id, { hook_event_name: 'Stop' });
    await expect(panel(page).getByText('Ended', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('The tests still run', { exact: true }), 'the last turn stays shown').toBeVisible();
  });

  // plan-session_activity/REQ-41 — scenario "A session with no turn"
  test('says "No turn yet." for a new hosted session with no message', async ({ page, request }) => {
    const folder = await newFolder('no-turn');
    await startHosted(request, folder);
    await openSession(page, folder);
    await openPanel(page);
    await expect(panel(page).getByText('No turn yet.', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('Running', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByText('Ended', { exact: true })).toHaveCount(0);
  });

  // plan-session_activity/REQ-42 — scenario "The panel follows the latest step"
  test('follows the latest step until the user scrolls up, then stays still', async ({ page }) => {
    const folder = await newFolder('scroll');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Date.now();
    const step = (i: number) => claudeSays(`Step ${String(i).padStart(3, '0')} ${'of a long explanation '.repeat(6)}`, iso(t0 - 60_000 + i));
    await files.write(userText('Go', iso(t0 - 70_000)), ...Array.from({ length: 60 }, (_, i) => step(i)));
    await runInTerminal(sessionId, folder);
    await openSession(page, folder, true);
    await openPanel(page);
    const area = treeArea(page);
    await expect(panel(page).getByText(/^Step 059 /)).toBeInViewport(PROMPTLY);
    expect(await atEnd(area), 'the view starts at the end').toBe(true);

    await files.write(step(60), step(61));
    await expect(panel(page).getByText(/^Step 061 /)).toBeInViewport(PROMPTLY);
    await expect.poll(() => atEnd(area), 'the view follows the new steps').toBe(true);

    await area.hover();
    await page.mouse.wheel(0, -1500);
    await expect.poll(() => atEnd(area), 'scrolled up').toBe(false);
    const scrolled = await area.evaluate((el) => el.scrollTop);
    await files.write(step(62), step(63));
    await expect(panel(page).getByText(/^Step 063 /)).toBeAttached(PROMPTLY);
    expect(await area.evaluate((el) => el.scrollTop), 'the view stays still').toBe(scrolled);
    await expect(panel(page).getByText(/^Step 063 /)).not.toBeInViewport();
  });

  // plan-session_activity/REQ-45, REQ-46 — scenario "A large turn stays usable"
  test('shows the last 200 of thousands of steps and 20 subagents in one wrapping group, one of them running for 16 hours', async ({ page }) => {
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
    await expect(panel(page).getByText(/^Step \d{4}$/)).toHaveCount(180);
    await expect(panel(page).getByText('Step 2999', { exact: true })).toBeAttached();
    await expect(panel(page).getByText('Step 2819', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByRole('button', { name: 'Show 200 earlier steps', exact: true })).toBeAttached();

    const boxes = await Promise.all((await workers.all()).map((card) => box(card)));
    const rows = new Set(boxes.map((b) => Math.round(b.y)));
    const columns = new Set(boxes.map((b) => Math.round(b.x)));
    expect(rows.size, 'the group wraps to several rows').toBeGreaterThan(1);
    expect(columns.size, 'several columns side by side').toBeGreaterThan(1);
    for (const b of boxes) expect(b.width, 'columns of at least 180 px').toBeGreaterThanOrEqual(179);

    const area = treeArea(page);
    await area.hover();
    const before = await area.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, -800);
    await expect.poll(() => area.evaluate((el) => el.scrollTop), 'the tree scrolls').toBeLessThan(before);
    await panel(page).getByRole('button', { name: 'Show 200 earlier steps', exact: true }).click();
    await expect(panel(page).getByText(/^Step \d{4}$/)).toHaveCount(380);
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
    expect(reached.some((name) => name.startsWith('BUTTON Show 51 earlier steps')), reached.join(' | ')).toBe(true);
    expect(reached.some((name) => name.startsWith('DIV')), `the tree area takes the focus: ${reached.join(' | ')}`).toBe(true);
  });
});
