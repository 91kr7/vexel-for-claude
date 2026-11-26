// e2e of plan-session_activity, batch latest-text. The tests write the transcripts, subagent files and metadata that Claude Code would write.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Line = Record<string, unknown>;

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const LIST_WIDTH_KEY = 'ai-client.list-width';
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 20_000 };
// REQ-12 asks for 2 s: under the load of the complete run the e2e checks that it happens, not how fast (the unit tests time it).
const PROMPTLY = { timeout: 15_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const cleanup: { process?: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-latest-text-'));
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
const latestLine = (target: Locator) => target.locator('.session-entry-latest');
const terminal = (page: Page) => page.locator('.xterm-rows');

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();
const userText = (text: string, timestamp: string): Line => ({ type: 'user', isSidechain: false, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
/** `timestamp` null → a line with no timestamp. */
const claudeText = (text: string, timestamp: string | null, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  ...(timestamp !== null && { timestamp }),
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const claudeThinks = (timestamp: string): Line => ({
  type: 'assistant',
  isSidechain: false,
  timestamp,
  message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Let me think about the next step', signature: 'sig' }] },
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
  liveActivity?: { atWork: boolean; latestText?: { text: string } };
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

/** What the browser computes for a CSS value set on `property` of a probe element in the session list (e.g. `var(--text-muted)` on `color`). */
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

test.describe('Latest-text line', () => {
  // plan-session_activity/REQ-2, REQ-6, REQ-8, REQ-9, REQ-12, REQ-15 — scenario "A working session shows Claude's latest text"
  test('a working hosted session shows the plain latest text with the time since it, which counts up', async ({ page, request }) => {
    const folder = await newFolder('hosted');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    // The page clock stays on `t0` until the test moves it: the shown times are exact, whatever the load.
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    await files.write(userText('Read the config', iso(t0 - 5_000)), claudeText('I am **reading** the `config` files', iso(t0)));
    await expect(latestLine(row)).toHaveText('I am reading the config files · 0 s', PROMPTLY);
    await page.clock.setFixedTime(t0 + 42_000);
    await expect(latestLine(row), 'the time counts up with no new data').toHaveText('I am reading the config files · 42 s');
    await page.clock.setFixedTime(t0 + 3 * 60_000);
    await expect(latestLine(row)).toHaveText('I am reading the config files · 3 min');

    await files.write(claudeText('Checked the notes of the morning', iso(t0 + 3 * 60_000 - 65 * 60_000)));
    await expect(latestLine(row)).toHaveText('Checked the notes of the morning · 1 h 05 min', PROMPTLY);
  });

  // plan-session_activity/REQ-3, REQ-4, REQ-12 — scenario "The text of a subagent wins when it writes last"
  test('the text of a subagent that writes last shows with its type, on an external session', async ({ page }) => {
    const folder = await newFolder('external');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const t0 = Math.floor(Date.now() / 1000) * 1000;
    await files.write(userText('Implement the batch', iso(t0 - 10_000)), claudeText('I start the developer agent', iso(t0 - 5_000)));
    await runInTerminal(sessionId, folder);
    await page.clock.setFixedTime(t0);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);
    await expect(latestLine(row)).toHaveText('I start the developer agent · 5 s', PROMPTLY);

    const developer = files.subagent('agent-a1b2c3d4');
    await developer.meta({ agentType: 'sdd-developer', description: 'Implement batch latest-text', toolUseId: 'toolu_01' });
    await developer.write({ ...userText('Implement the batch', iso(t0 - 4_000)), isSidechain: true }, claudeText('Overwriting the whole CommonServiceImpl class', iso(t0), true));
    await expect(latestLine(row)).toHaveText('sdd-developer: Overwriting the whole CommonServiceImpl class · 0 s', PROMPTLY);
    const type = latestLine(row).getByText('sdd-developer:', { exact: true });
    await expect(type).toBeVisible();
    expect(await style(type, 'font-weight'), 'the type in weight 600').toBe('600');
  });

  // plan-session_activity/REQ-1, REQ-11 — scenario "A background subagent keeps the session at work"
  test('an idle session with a running background subagent shows its text, until the subagent finishes', async ({ page, request }) => {
    const folder = await newFolder('background');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    const now = Date.now();
    await files.write(userText('Audit the repository in the background', iso(now - 6_000)), claudeText('The audit agent runs in the background', iso(now - 5_000)));
    const audit = files.subagent('agent-bg01');
    await audit.meta({ agentType: 'general-purpose', description: 'Audit the repository' });
    await audit.write(claudeText('Scanning the **dependencies** of the server', iso(now - 1_000), true));
    await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    await expect(latestLine(row)).toContainText('general-purpose: Scanning the dependencies of the server ·', PROMPTLY);
    expect((await summaryOf(request, id))?.state, 'the entry stays idle').toBe('idle');

    await audit.meta({ agentType: 'general-purpose', description: 'Audit the repository', finished: true });
    await expect(latestLine(row), 'the line goes when the subagent finishes').toHaveCount(0, PROMPTLY);
  });

  // plan-session_activity/REQ-5, REQ-10 — scenario "Thinking and old turns never show"
  test('a new turn where Claude only thinks shows no line, and never the text of the previous turn', async ({ page, request }) => {
    const folder = await newFolder('new-turn');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    const now = Date.now();
    await files.write(userText('Fix the login bug', iso(now - 60_000)), claudeText('The login bug is fixed', iso(now - 50_000)));
    await expect(latestLine(row)).toContainText('The login bug is fixed', PROMPTLY);
    await postHook(request, id, { hook_event_name: 'Stop', session_id: claudeSessionId });
    await expect(latestLine(row)).toHaveCount(0, PROMPTLY);

    await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Now add a test', session_id: claudeSessionId });
    await files.write(userText('Now add a test', iso(now - 1_000)), claudeThinks(iso(now)));
    await expect
      .poll(async () => (await summaryOf(request, id))?.liveActivity, { ...PROMPTLY, message: 'the server reads the new turn' })
      .toEqual({ atWork: true, lastEventAt: iso(now), waitingFor: 'response' });
    await expect(row.getByText('Running', { exact: true })).toBeVisible();
    await expect(latestLine(row)).toHaveCount(0);
    await expect(row).not.toContainText('The login bug is fixed');

    await files.write(claudeText('Writing the test of the login', iso(now + 1_000)));
    await expect(latestLine(row), 'the first text of the new turn shows').toContainText('Writing the test of the login', PROMPTLY);
  });

  // plan-session_activity/REQ-7, REQ-8 — scenario "A long text stays on two lines"; batch decision "Look and place of the latest-text line"
  test('a long text in a narrow list stays on two lines cut with an ellipsis, with the time visible at its end', async ({ page, request }) => {
    const folder = await newFolder('long');
    const claudeSessionId = uuid();
    const files = claudeSession(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LIST_WIDTH_KEY, '180'] as const);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    const words = 'The parser now reads every block of the transcript and keeps the order of the steps, ';
    const long = words.repeat(4).slice(0, 299).trimEnd().padEnd(299, 'x') + '.';
    expect(long).toHaveLength(300);
    await files.write(userText('Explain the parser', iso(Date.now() - 2_000)), claudeText(long, iso(Date.now())));
    const line = latestLine(row);
    await expect(line).toContainText(long.slice(0, 40), PROMPTLY);

    const text = line.locator('.session-entry-latest-text');
    const time = line.locator('time');
    await expect(time).toHaveText(/^\d+ s$/);
    const textBox = await box(text);
    const timeBox = await box(time);
    const rowBox = await box(row);
    near(textBox.height, 32, 'the text takes two lines of 16 px');
    const clamp = await text.evaluate((el) => ({
      cut: el.scrollHeight > el.clientHeight + 1,
      clamp: getComputedStyle(el).getPropertyValue('-webkit-line-clamp'),
      overflow: getComputedStyle(el).overflow,
    }));
    expect(clamp.cut, 'the text is longer than two lines').toBe(true);
    expect(clamp.clamp, 'two lines with an ellipsis at the end of the second one').toBe('2');
    expect(clamp.overflow).toBe('hidden');
    await expect(time).toBeVisible();
    expect(timeBox.x + timeBox.width, 'the time stays inside the entry').toBeLessThanOrEqual(rowBox.x + rowBox.width);
    expect(timeBox.x, 'the time sits after the text').toBeGreaterThanOrEqual(textBox.x);
    near(timeBox.y + timeBox.height, textBox.y + textBox.height, 'the time sits on the last line of the text', 3);

    const labelBox = await box(row.locator('.session-entry-label'));
    const line2Box = await box(row.locator('.session-entry-detail'));
    const lineBox = await box(line);
    near(textBox.x, labelBox.x, '16 px in, as the label');
    near(lineBox.y - (line2Box.y + line2Box.height), 2, 'with no tool line, the line is 2 px below line 2', 1.5);
    const barBox = await box(row.locator('.progress-bar'));
    near(barBox.y - (lineBox.y + lineBox.height), 6, 'the progress bar is 6 px below the line', 1.5);
    expect(await style(line, 'font-size')).toBe('11.5px');
    expect(await style(line, 'line-height')).toBe('16px');
    expect(await style(text, 'color')).toBe(await computed(page, 'color', 'var(--text-secondary)'));
    const timeText = line.locator('.session-entry-latest-time');
    expect(await timeText.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'the time is not cut').toBe(true);
    expect(await style(timeText, 'font-size')).toBe('10px');
    expect(await style(timeText, 'font-variant-numeric')).toBe('tabular-nums');
    expect(await style(timeText, 'color')).toBe(await computed(page, 'color', 'var(--text-muted)'));
    expect(await style(timeText, 'font-family'), 'the time in the mono font').toBe(await computed(page, 'font-family', 'var(--font-mono)'));
  });

  // plan-session_activity/REQ-11 — scenario "No line on sessions that need input or have ended"
  test('entries that need input, have ended or are idle with no running subagent show no line', async ({ page, request }) => {
    const folders = { asking: await newFolder('asking'), ended: await newFolder('ended'), idle: await newFolder('idle') };
    const ids: Record<string, string> = {};
    await page.goto('/');
    const now = Date.now();
    for (const [name, folder] of Object.entries(folders)) {
      const claudeSessionId = uuid();
      const files = claudeSession(folder, claudeSessionId);
      ids[name] = await startWorkingHosted(request, folder, claudeSessionId);
      await files.write(userText(`Task of ${name}`, iso(now - 10_000)), claudeText(`Text of the ${name} turn`, iso(now - 5_000)));
      await expect(latestLine(entry(page, folder)), `${name}: the line shows while working`).toContainText(`Text of the ${name} turn`, PROMPTLY);
    }

    await postHook(request, ids.asking!, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    expect((await request.post(`/api/sessions/${ids.ended}/stop`)).status()).toBeLessThan(300);
    await postHook(request, ids.idle!, { hook_event_name: 'Stop' });

    await expect(item(page, folders.asking)).toContainText('Needs Input', PROMPTLY);
    await expect.poll(async () => (await summaryOf(request, ids.ended!))?.state, PROMPTLY).toBe('ended');
    await expect.poll(async () => (await summaryOf(request, ids.idle!))?.state, PROMPTLY).toBe('idle');
    for (const [name, folder] of Object.entries(folders)) {
      await expect(latestLine(item(page, folder)), `${name}: no latest-text line`).toHaveCount(0, PROMPTLY);
      await expect(item(page, folder)).not.toContainText(`Text of the ${name} turn`);
    }
  });

  // plan-session_activity/REQ-13 — scenario "Missing data hides only its part"
  test('a subagent with no agent type and a text line with no timestamp shows the text alone', async ({ page }) => {
    const folder = await newFolder('missing');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const now = Date.now();
    await files.write(userText('Look around', iso(now - 10_000)), claudeText('I start a helper', iso(now - 9_000)));
    const helper = files.subagent('agent-0f0f');
    await helper.meta({ description: 'Look around', toolUseId: 'toolu_02', agentType: 12 });
    await helper.write(claudeText('Found **three** config files', null, true));
    await runInTerminal(sessionId, folder);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);

    await expect(latestLine(row)).toHaveText('Found three config files', PROMPTLY);
    await expect(latestLine(row).locator('time')).toHaveCount(0);
    await expect(row.locator('.session-entry-label')).toBeVisible();
    await expect(row.locator('.session-entry-metrics')).toBeVisible();
    await expect(row.getByText('Running', { exact: true })).toBeVisible();
  });

  // plan-session_activity/REQ-14 — scenario "A huge subagent does not slow the list"
  test('a subagent of thousands of steps over 16 hours shows its latest text, and the list stays usable', async ({ page, request }) => {
    const folder = await newFolder('huge');
    const sessionId = uuid();
    const files = claudeSession(folder, sessionId);
    const start = Date.now() - 16 * 3600_000;
    await files.write(userText('Run the full regression', iso(start - 60_000)), claudeText('The tester agent runs the regression', iso(start - 30_000)));
    const tester = files.subagent('agent-77aa');
    await tester.meta({ agentType: 'sdd-tester', description: 'Full regression' });
    const steps: Line[] = [];
    for (let step = 0; step < 3000; step += 1) {
      const at = iso(start + step * 19_000);
      steps.push(
        {
          type: 'assistant',
          isSidechain: true,
          timestamp: at,
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: `Step ${step}: checking the output of the module tests` },
              { type: 'tool_use', id: `toolu_${step}`, name: 'Bash', input: { command: `mvn test -pl module-${step}` } },
            ],
          },
        },
        { type: 'user', isSidechain: true, timestamp: at, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `toolu_${step}`, content: 'BUILD SUCCESS\n'.repeat(20) }] } },
      );
    }
    steps.push(claudeText('All 3000 modules pass', iso(Date.now()), true));
    await tester.write(...steps);
    await runInTerminal(sessionId, folder);

    const otherFolder = await newFolder('other');
    const otherSessionId = uuid();
    claudeSession(otherFolder, otherSessionId);
    await startWorkingHosted(request, otherFolder, otherSessionId);

    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);
    await expect(latestLine(row)).toContainText('sdd-tester: All 3000 modules pass ·', PROMPTLY);

    await list(page).getByTitle(otherFolder, { exact: true }).click();
    await expect(terminal(page), 'another session opens').toContainText(`CWD:${otherFolder}`);
    await list(page).getByTitle(folder, { exact: true }).click();
    await expect(latestLine(row)).toContainText('sdd-tester: All 3000 modules pass ·');
  });
});
