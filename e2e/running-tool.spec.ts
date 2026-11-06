// e2e of plan-session_list_improvements, batch running-tool. The tests write the main transcripts that Claude Code would write.
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
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-running-tool-'));
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
const toolLine = (target: Locator) => target.locator('.session-entry-tool');

const toolUse = (calls: [string, string, object][]) => ({
  type: 'assistant',
  isSidechain: false,
  message: { role: 'assistant', content: calls.map(([id, name, input]) => ({ type: 'tool_use', id, name, input })) },
});
const toolResult = (id: string) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const userText = (text: string) => ({ type: 'user', isSidechain: false, message: { role: 'user', content: text } });

async function newFolder(name: string): Promise<string> {
  const folder = await mkdtemp(path.join(projectsRoot, `${name}-`));
  return folder;
}

/** Appends lines to the main transcript of a Claude Code session, as Claude Code does while it works. */
async function transcript(folder: string, claudeSessionId: string): Promise<(...entries: object[]) => Promise<void>> {
  const file = path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${claudeSessionId}.jsonl`);
  await mkdir(path.dirname(file), { recursive: true });
  cleanup.push({ files: [file] });
  return (...entries) => appendFile(file, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

async function startWorkingHosted(request: APIRequestContext, folder: string, claudeSessionId: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Run the tests', session_id: claudeSessionId });
  return id;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/hook-events`, { data: event })).status()).toBe(204);
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

const uuid = () => crypto.randomUUID();

test.describe('Running tool line', () => {
  // plan-session_list_improvements/REQ-14, REQ-15, REQ-24: a hosted working entry shows "Bash: npm test" within 2 s
  test('a hosted working session shows its running tool within 2 seconds', async ({ page, request }) => {
    const folder = await newFolder('hosted');
    const claudeSessionId = uuid();
    const write = await transcript(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();
    await expect(toolLine(row)).toHaveCount(0);

    await write(userText('Run the tests'), toolUse([['t1', 'Bash', { command: 'npm test', description: 'Run the unit tests' }]]));
    await expect(toolLine(row)).toHaveText('Bash: npm test', WITHIN_2_S);
  });

  // plan-session_list_improvements/REQ-14, REQ-24: an external working entry shows "Read: <file path>" within 2 s
  test('an external working session shows its running tool within 2 seconds', async ({ page }) => {
    const folder = await newFolder('external');
    const sessionId = uuid();
    const write = await transcript(folder, sessionId);
    await write(userText('Read the readme'));
    await runInTerminal(sessionId, folder);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible(SCAN);

    const file = path.join(folder, 'README.md');
    await write(toolUse([['t1', 'Read', { file_path: file }]]));
    await expect(toolLine(row)).toHaveText(`Read: ${file}`, WITHIN_2_S);
  });

  // plan-session_list_improvements/REQ-16, REQ-17, REQ-18, REQ-19: last tool, "+2", first line only, one line cut with an ellipsis
  test('several tools show the last one with "+2", a long multi-line command on one cut line', async ({ page, request }) => {
    const folder = await newFolder('several');
    const claudeSessionId = uuid();
    const write = await transcript(folder, claudeSessionId);
    await startWorkingHosted(request, folder, claudeSessionId);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    await write(toolUse([['n1', 'TodoWrite', { todos: [] }]]));
    await expect(toolLine(row), 'a tool with no main argument shows its name only').toHaveText('TodoWrite');

    const firstLine = `npx vitest run ${'src/server/sessions/running-tool-monitor.test.ts '.repeat(6)}--reporter=dot`;
    await write(
      toolResult('n1'),
      toolUse([
        ['t1', 'Read', { file_path: '/srv/app/a.ts' }],
        ['t2', 'Grep', { pattern: 'TODO' }],
        ['t3', 'Bash', { command: `${firstLine}\nnpm run build\nnpm start` }],
      ]),
    );
    const line = toolLine(row);
    await expect(line).toContainText(`Bash: ${firstLine.trim()}`);
    await expect(line).toContainText('+2');
    await expect(line).not.toContainText('npm run build');

    const plus = line.getByText('+2', { exact: true });
    await expect(plus, '"+2" stays visible').toBeVisible();
    const [lineBox, plusBox, rowBox] = await Promise.all([line.boundingBox(), plus.boundingBox(), row.boundingBox()]);
    expect(lineBox!.height, 'one line').toBeLessThan(20);
    expect(plusBox!.x + plusBox!.width, '"+2" inside the entry').toBeLessThanOrEqual(rowBox!.x + rowBox!.width);

    const cut = await line.evaluate((el) => {
      const texts = [el, ...el.querySelectorAll('*')].filter((node) => getComputedStyle(node).textOverflow === 'ellipsis');
      return texts.map((node) => ({ overflowing: node.scrollWidth > node.clientWidth, whiteSpace: getComputedStyle(node).whiteSpace }));
    });
    expect(cut.some((node) => node.overflowing), 'the argument is cut with an ellipsis').toBe(true);
    expect(cut.every((node) => node.whiteSpace === 'nowrap' || node.whiteSpace === 'pre')).toBe(true);
  });

  // plan-session_list_improvements/REQ-21, REQ-22, REQ-23: a fast tool stays about 1 s; no tool line when no tool runs or the turn ends
  test('the tool line holds a fast tool, then goes when no tool runs and when the turn ends', async ({ page, request }) => {
    const folder = await newFolder('fast');
    const claudeSessionId = uuid();
    const write = await transcript(folder, claudeSessionId);
    const id = await startWorkingHosted(request, folder, claudeSessionId);
    await page.goto('/');
    const row = entry(page, folder);
    await expect(row).toBeVisible();

    await write(toolUse([['t1', 'Bash', { command: 'true' }]]));
    await expect(toolLine(row)).toHaveText('Bash: true', WITHIN_2_S);
    const shownAt = Date.now();
    await write(toolResult('t1'));
    await expect(toolLine(row)).toHaveCount(0, WITHIN_2_S);
    expect(Date.now() - shownAt, 'shown for about 1 second at least').toBeGreaterThanOrEqual(700);

    await write(toolUse([['t2', 'Bash', { command: 'sleep 60' }]]));
    await expect(toolLine(row)).toHaveText('Bash: sleep 60', WITHIN_2_S);
    await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
    const item = list(page).getByRole('listitem').filter({ has: page.getByTitle(folder, { exact: true }) });
    await expect(item).toContainText('Needs Input');
    await expect(item.locator('.session-entry-tool')).toHaveCount(0);
    await expect(item).not.toContainText('Bash: sleep 60');
  });
});
