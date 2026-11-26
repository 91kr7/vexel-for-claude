// e2e of plan-session_activity, batch stall-signal. The tests write the transcripts, subagent files and metadata that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Line = Record<string, unknown>;

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const LIST_WIDTH_KEY = 'ai-client.list-width';
const MIN = 60_000;
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 20_000 };
// REQ-22 asks for 2 s: under the load of the complete run the e2e checks that it happens, not how fast (the unit tests time it).
const PROMPTLY = { timeout: 15_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-stall-signal-'));
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
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: page.getByTitle(folder, { exact: true }) });
const stallLine = (target: Locator) => target.locator('.session-entry-stall');
const latestLine = (target: Locator) => target.locator('.session-entry-latest');

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();
const userText = (text: string, timestamp: string): Line => ({ type: 'user', isSidechain: false, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeText = (text: string, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const toolCall = (id: string, name: string, input: object | undefined, timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, ...(input !== undefined && { input }) }] },
});
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
  // Each test folder is unique, so its project folder holds only this session's files.
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

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
}

async function startWorkingHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
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

interface Summary {
  id: string;
  state: string;
  liveActivity?: { atWork: boolean; lastEventAt?: string };
}

const summaryOf = async (request: APIRequestContext, id: string) =>
  ((await (await request.get('/api/sessions')).json()) as Summary[]).find((session) => session.id === id);

/** Waits for the effects that end (list cascade, entry slide-in): a box read while one plays sits where the effect has moved it. */
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

const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

const style = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** What the browser computes for a CSS value set on `property` of a probe element in the session list (e.g. `var(--amber-400)` on `color`). */
const computed = (page: Page, property: string, value: string) =>
  list(page).evaluate(
    (host, [p, v]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(p, v);
      host.append(probe);
      const result = getComputedStyle(probe).getPropertyValue(p);
      probe.remove();
      return result;
    },
    [property, value] as const,
  );

/** For each folder, in list order: its group title and whether its entry names the state `Running` or `Needs Input`. */
const layoutOf = (page: Page, folders: string[]) =>
  list(page).evaluate(
    (host, wanted) =>
      [...host.querySelectorAll('li')].flatMap((li) => {
        const folder = wanted.find((f) => li.querySelector(`[title="${CSS.escape(f)}"]`));
        if (folder === undefined) return [];
        const text = li.textContent ?? '';
        const state = text.includes('Needs Input') ? 'Needs Input' : text.includes('Running') ? 'Running' : 'other';
        return [{ folder, group: li.closest('.session-group')?.querySelector('h2')?.textContent ?? '', state }];
      }),
    folders,
  );

test.describe('Stall signal', () => {
  // plan-session_activity/REQ-16, REQ-18, REQ-19, REQ-21, REQ-24 — scenario "A silent session shows what it waits for"
  test('a silent hosted session shows the tool its subagent runs, with a clock icon, in a look apart, and the time counts up', async ({ page, request }) => {
    const folder = await newFolder('silent');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    // The page clock stays on `t0` until the test moves it: the shown times are exact, whatever the load.
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const last = t0 - 8 * MIN;
    await files.write(
      userText('Run the tests of the server', iso(last - 60_000)),
      claudeText('I start the tester agent', iso(last - 50_000)),
      toolCall('toolu_t1', 'Agent', { description: 'Run the tests', prompt: 'Run mvn test', subagent_type: 'sdd-tester' }, iso(last - 40_000)),
    );
    const tester = files.subagent('agent-5e5e01');
    await tester.meta({ agentType: 'sdd-tester', description: 'Run the tests', toolUseId: 'toolu_t1' });
    await tester.write({ ...userText('Run mvn test', iso(last - 30_000)), isSidechain: true }, toolCall('toolu_b1', 'Bash', { command: 'mvn test', description: 'Run the tests' }, iso(last), true));
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    const stall = stallLine(row);
    const text = 'No activity for 8 min · sdd-tester: mvn test running';
    await expect(stall).toHaveText(text, PROMPTLY);
    await expect(row.getByTitle(text, { exact: true }), 'the whole text as tooltip').toHaveCount(1);
    await expect(latestLine(row), 'both lines show together').toHaveText('I start the tester agent · 8 min');

    const icon = stall.locator('svg');
    await expect(icon, 'the clock icon').toHaveCount(1);
    const iconBox = await box(icon);
    near(iconBox.width, 12, 'icon width');
    near(iconBox.height, 12, 'icon height');
    const textBox = await box(stall.getByText(text, { exact: true }));
    near(textBox.x - (iconBox.x + iconBox.width), 4, 'the text 4 px after the icon');
    near(iconBox.x, (await box(row.locator('.session-entry-label'))).x, '16 px in, as the label');
    const stallBox = await box(stall);
    const latestBox = await box(latestLine(row));
    near(stallBox.y - (latestBox.y + latestBox.height), 2, 'the signal is 2 px below the latest-text line', 1.5);
    near(stallBox.height, 15, 'one line of 15 px');
    near((await box(row.locator('.progress-bar'))).y - (stallBox.y + stallBox.height), 6, 'the progress bar is 6 px below the signal', 1.5);

    const amber = await computed(page, 'color', 'var(--amber-400)');
    const mono = await computed(page, 'font-family', 'var(--font-mono)');
    expect(await style(stall, 'color'), 'amber-400').toBe(amber);
    expect(await style(stall, 'font-family'), 'the mono font').toBe(mono);
    expect(await style(stall, 'font-size')).toBe('10px');
    expect(await style(stall, 'line-height')).toBe('15px');
    const latestText = latestLine(row).locator('.session-entry-latest-text');
    expect(await style(latestText, 'color'), 'the latest-text line has another colour').not.toBe(amber);
    expect(await style(latestText, 'font-family'), 'and another font').not.toBe(mono);

    await row.hover();
    expect(await style(stall, 'color'), 'amber also on hover').toBe(amber);
    await row.click();
    await expect(row).toHaveAttribute('aria-current', 'true');
    expect(await style(stall, 'color'), 'amber also when open').toBe(amber);

    await page.clock.setFixedTime(t0 + MIN);
    await expect(stall, 'the time counts up with no new data').toHaveText('No activity for 9 min · sdd-tester: mvn test running');
  });

  // session-list spec: one line cut with an ellipsis, the whole text as tooltip
  test('a long signal in a narrow list stays on one line, cut with an ellipsis', async ({ page, request }) => {
    const folder = await newFolder('narrow');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const command = 'mvn -pl server,client,common -am clean verify -DskipITs=false -Dsurefire.rerunFailingTestsCount=2';
    await files.write(userText('Verify everything', iso(t0 - 8 * MIN)), toolCall('toolu_v1', 'Bash', { command }, iso(t0 - 7 * MIN)));
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LIST_WIDTH_KEY, '180'] as const);
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    const full = `No activity for 7 min · ${command} running`;
    const stall = stallLine(row);
    await expect(stall).toHaveText(full, PROMPTLY);
    await expect(row.getByTitle(full, { exact: true })).toHaveCount(1);
    const text = stall.getByText(full, { exact: true });
    const cut = await text.evaluate((el) => ({
      cut: el.scrollWidth > el.clientWidth + 1,
      wrap: getComputedStyle(el).whiteSpace,
      overflow: getComputedStyle(el).textOverflow,
    }));
    expect(cut.cut, 'the text is longer than the line').toBe(true);
    expect(cut.wrap).toBe('nowrap');
    expect(cut.overflow).toBe('ellipsis');
    const stallBox = await box(stall);
    near(stallBox.height, 15, 'one line of 15 px');
    const rowBox = await box(row);
    expect(stallBox.x + stallBox.width, 'the line stays inside the entry').toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
  });

  // plan-session_activity/REQ-17, REQ-22 — scenario "Any activity removes the signal"
  test('a tool result of a subagent removes the signal of an external session', async ({ page }) => {
    const folder = await newFolder('external');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const last = t0 - 6 * MIN;
    await files.write(userText('Check the build', iso(last - 60_000)), toolCall('toolu_x1', 'Agent', { description: 'Check the build' }, iso(last - 50_000)));
    const checker = files.subagent('agent-c0c0a1');
    await checker.meta({ agentType: 'general-purpose', description: 'Check the build', toolUseId: 'toolu_x1' });
    await checker.write(toolCall('toolu_y1', 'Bash', { command: 'npm run build' }, iso(last), true));
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);
    await expect(stallLine(row)).toHaveText('No activity for 6 min · general-purpose: npm run build running', PROMPTLY);

    await checker.write(toolResult('toolu_y1', iso(t0), true));
    await expect(stallLine(row), 'the signal goes at the next activity').toHaveCount(0, PROMPTLY);
    await expect(row.getByText('Running', { exact: true }), 'the entry stays as it was').toBeVisible();
  });

  // plan-session_activity/REQ-20 — scenario "Several tools run"
  test('with several running tools the signal names the one that started first, then "+2"', async ({ page, request }) => {
    const folder = await newFolder('several');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(
      userText('Build, explore and test', iso(t0 - 10 * MIN)),
      toolCall('toolu_m1', 'Bash', { command: 'npm run build' }, iso(t0 - 9 * MIN)),
      toolCall('toolu_a1', 'Agent', { description: 'Explore the code' }, iso(t0 - 8 * MIN)),
      toolCall('toolu_a2', 'Agent', { description: 'Run the tests' }, iso(t0 - 8 * MIN)),
    );
    const explorer = files.subagent('agent-aa0001');
    await explorer.meta({ agentType: 'Explore', toolUseId: 'toolu_a1' });
    await explorer.write(toolCall('toolu_g1', 'Grep', { pattern: 'TODO' }, iso(t0 - 7 * MIN), true));
    const tester = files.subagent('agent-bb0002');
    await tester.meta({ agentType: 'sdd-tester', toolUseId: 'toolu_a2' });
    await tester.write(toolCall('toolu_b2', 'Bash', { command: 'mvn test' }, iso(t0 - 6 * MIN), true));
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await expect(stallLine(row)).toHaveText('No activity for 6 min · npm run build running +2', PROMPTLY);
  });

  // plan-session_activity/REQ-18, REQ-22 — scenario "No tool runs"
  test("with no running tool the signal waits for Claude's response, and goes when the session is no longer at work", async ({ page, request }) => {
    const folder = await newFolder('no-tool');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(
      userText('Read the notes', iso(t0 - 7 * MIN)),
      toolCall('toolu_r1', 'Read', { file_path: '/notes.md' }, iso(t0 - 6.5 * MIN)),
      toolResult('toolu_r1', iso(t0 - 6 * MIN)),
    );
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await expect(stallLine(row)).toHaveText("No activity for 6 min · waiting for Claude's response", PROMPTLY);

    await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
    await expect(stallLine(row), 'the signal goes when the session is no longer at work').toHaveCount(0, PROMPTLY);
  });

  // plan-session_activity/REQ-23, REQ-25 — scenario "The signal stays out of the order and of needs-input entries"
  test('the signal shows only on the entry that does not need input, and no entry changes state, group or place', async ({ page, request }) => {
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    const last = t0 - 7 * MIN;
    const folders = { silent: await newFolder('silent'), asking: await newFolder('asking'), fresh: await newFolder('fresh') };
    const ids: Record<string, string> = {};
    for (const [name, folder] of Object.entries(folders)) {
      const claudeSessionId = uuid();
      const files = claudeSession(folder, claudeSessionId);
      ids[name] = await startWorkingHosted(request, folder, claudeSessionId);
      const end = name === 'fresh' ? t0 : last;
      await files.write(userText(`Task of ${name}`, iso(last - 60_000)), toolCall(`toolu_${name}`, 'Agent', { description: `Helper of ${name}` }, iso(last - 50_000)));
      const helper = files.subagent(`agent-${name}01`);
      await helper.meta({ agentType: 'general-purpose', toolUseId: `toolu_${name}` });
      await helper.write(toolCall(`toolu_${name}_bash`, 'Bash', { command: `make ${name}` }, iso(end), true));
    }
    await postHook(request, ids.asking!, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    await expect
      .poll(async () => (await summaryOf(request, ids.asking!))?.liveActivity, { ...PROMPTLY, message: 'the session that needs input is at work, silent for 7 minutes' })
      .toMatchObject({ atWork: true, lastEventAt: iso(last) });

    await page.clock.setFixedTime(t0 - 3 * MIN);
    await page.goto('/');
    const all = Object.values(folders);
    for (const folder of all) await expect(item(page, folder)).toBeVisible();
    await expect(item(page, folders.asking)).toContainText('Needs Input', PROMPTLY);
    await expect(list(page).locator('.session-entry-stall')).toHaveCount(0);
    const before = await layoutOf(page, all);

    await page.clock.setFixedTime(t0);
    await expect(stallLine(item(page, folders.silent))).toHaveText('No activity for 7 min · general-purpose: make silent running', PROMPTLY);
    await expect(stallLine(item(page, folders.asking)), 'never on an entry that needs input').toHaveCount(0);
    await expect(stallLine(item(page, folders.fresh))).toHaveCount(0);
    await effectsDone(page);
    expect(await layoutOf(page, all), 'same groups, places and states').toEqual(before);
    expect(before).toHaveLength(3);
    for (const [name, folder] of Object.entries(folders)) {
      expect(before.find((e) => e.folder === folder)?.state, name).toBe(name === 'asking' ? 'Needs Input' : 'Running');
    }
    for (const [name, id] of Object.entries(ids)) {
      expect((await summaryOf(request, id))?.state, `${name} keeps its state`).toBe(name === 'asking' ? 'needs_input' : 'working');
    }
  });

  // plan-session_activity/REQ-26 — scenario "Missing data hides only its part"
  test('a subagent with no agent type running a tool with no input shows the tool name alone', async ({ page, request }) => {
    const folder = await newFolder('missing');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(userText('Search the web', iso(t0 - 7 * MIN)), toolCall('toolu_w1', 'Agent', { description: 'Search' }, iso(t0 - 6.5 * MIN)));
    const searcher = files.subagent('agent-0f0f01');
    await searcher.meta({ description: 'Search', toolUseId: 'toolu_w1', agentType: 12 });
    await searcher.write(toolCall('toolu_s1', 'WebSearch', undefined, iso(t0 - 6 * MIN), true));
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await expect(stallLine(row)).toHaveText('No activity for 6 min · WebSearch running', PROMPTLY);
    await expect(row.locator('.session-entry-label')).toBeVisible();
    await expect(row.locator('.session-entry-metrics')).toBeVisible();
  });
});
