// e2e of plan-session_activity, batch turn-panel, in the desktop app (Electron group only).
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, type Page, _electron, expect, test } from '@playwright/test';
import { quitDesktop } from './desktop-quit';

type Line = Record<string, unknown>;

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const electronBinary = createRequire(import.meta.url)('electron') as string;
const fakeClaude = fileURLToPath(new URL('../test-support/fake-claude.mjs', import.meta.url));
const PROMPTLY = { timeout: 15_000 };

const apps: ElectronApplication[] = [];
const ports: number[] = [];
const dirs: string[] = [];
const processes: ChildProcess[] = [];

function listenerPids(listening: number): number[] {
  const out = execFileSync('ss', ['-Hltnp', `sport = :${listening}`], { encoding: 'utf8' });
  return [...out.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1]));
}

test.afterEach(async () => {
  for (const app of apps.splice(0)) await quitDesktop(app);
  for (const port of ports.splice(0)) for (const pid of listenerPids(port)) if (pid !== process.pid) process.kill(pid, 'SIGKILL');
  for (const child of processes.splice(0)) child.kill('SIGKILL');
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  await new Promise((resolve) => server.close(resolve));
  ports.push(address.port);
  return address.port;
}

/** Environment of an isolated desktop session: its own HOME, so its own Electron profile and single-instance lock. */
async function desktopEnv(port: number): Promise<Record<string, string>> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-desktop-turn-')));
  dirs.push(home);
  const base = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  delete base.ELECTRON_RUN_AS_NODE;
  return {
    ...base,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    XDG_DATA_HOME: path.join(home, '.local/share'),
    PORT: String(port),
    AI_CLIENT_NODE: process.execPath,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    AI_CLIENT_CLAUDE_CLI: fakeClaude,
  };
}

const iso = (ms: number) => new Date(ms).toISOString();
const userText = (text: string, timestamp: string, sidechain = false): Line => ({ type: 'user', isSidechain: sidechain, timestamp, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const claudeSays = (content: string | object[], timestamp: string, sidechain = false): Line => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp,
  message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content },
});
const agentUse = (id: string, description: string, type: string) => ({ type: 'tool_use', id, name: 'Agent', input: { description, prompt: 'Do the work', subagent_type: type } });

const projectDir = (claudeDir: string, folder: string) => path.join(claudeDir, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));

async function writeLines(file: string, lines: Line[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

/** Simulates Claude Code at work in another terminal on a turn with one subagent: a live process, its session file and the transcripts. */
async function runExternalTurn(claudeDir: string, sessionId: string, folder: string): Promise<void> {
  const t0 = Date.now();
  const project = projectDir(claudeDir, folder);
  await writeLines(path.join(project, `${sessionId}.jsonl`), [
    userText('Implement the batch', iso(t0 - 20_000)),
    claudeSays('Looking at the batch', iso(t0 - 15_000)),
    claudeSays([agentUse('dev', 'Implement INT-1', 'sdd-developer')], iso(t0 - 10_000)),
  ]);
  const subagent = path.join(project, sessionId, 'subagents', 'agent-dev.jsonl');
  await writeLines(subagent, [userText('Implement INT-1', iso(t0 - 9_000), true), claudeSays('Reading the spec', iso(t0 - 5_000), true)]);
  await writeFile(subagent.replace(/\.jsonl$/, '.meta.json'), JSON.stringify({ agentType: 'sdd-developer', description: 'Implement INT-1', toolUseId: 'dev' }));
  const sessions = path.join(claudeDir, 'sessions');
  await mkdir(sessions, { recursive: true });
  const child = spawn('sleep', ['300'], { stdio: 'ignore' });
  processes.push(child);
  const pid = child.pid ?? 0;
  execFileSync('mkfifo', [path.join(sessions, `${pid}.5a6b7c8d.key`)]);
  await writeFile(path.join(sessions, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'busy', updatedAt: Date.now() }));
}

async function post(port: number, url: string, body: object): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: page.getByTitle(folder, { exact: true }) });
const mainArea = (page: Page) => page.getByRole('main');
const header = (page: Page) => mainArea(page).locator('.main-view:not(.is-leaving) .session-header');
const turnButton = (page: Page) => header(page).getByRole('button', { name: 'Turn Panel', exact: true });
const panel = (page: Page) => mainArea(page).getByRole('region', { name: 'Turn Panel', exact: true });

/** Whether the focused element draws the focus ring colour as an outline or a box-shadow. */
const focusedShowsRing = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const ring = getComputedStyle(probe).color;
    probe.remove();
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ring) || s.boxShadow.includes(ring);
  });
const focusInPanel = (page: Page) => page.evaluate(() => document.activeElement?.closest('section[aria-label="Turn Panel"]') != null);

test.describe('Turn panel in the desktop app', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    execFileSync('npx', ['tsc', '-b', 'tsconfig.desktop.build.json'], { cwd: repoRoot, stdio: 'ignore' });
    expect(existsSync(path.join(repoRoot, 'dist/web/index.html'))).toBe(true);
  });

  // plan-session_activity/REQ-48, REQ-47, REQ-27 — scenario "The panel works with the keyboard and in the desktop window"
  test('opens beside a hosted session, and from the keyboard on an external session with the focus ring on each focused element', async () => {
    const port = await freePort();
    const env = await desktopEnv(port);
    const claudeDir = env.CLAUDE_CONFIG_DIR!;
    const hostedFolder = path.join(env.HOME!, 'hosted-work');
    const externalFolder = path.join(env.HOME!, 'external-work');
    await mkdir(hostedFolder);
    await mkdir(externalFolder);
    await runExternalTurn(claudeDir, '8f1c2d3e-0000-4000-8000-0000000000f1', externalFolder);

    const app = await _electron.launch({ executablePath: electronBinary, args: ['.'], cwd: repoRoot, env });
    apps.push(app);
    const page = await app.firstWindow();
    await expect(list(page)).toBeVisible({ timeout: 20_000 });

    const created = await post(port, '/api/sessions', { path: hostedFolder });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const claudeSessionId = crypto.randomUUID();
    expect((await post(port, `/api/sessions/${id}/hook-events`, { hook_event_name: 'UserPromptSubmit', prompt: 'Go', session_id: claudeSessionId })).ok).toBe(true);
    await writeLines(path.join(projectDir(claudeDir, hostedFolder), `${claudeSessionId}.jsonl`), [userText('Go', iso(Date.now() - 2_000)), claudeSays('Hosted turn text', iso(Date.now()))]);

    await entry(page, hostedFolder).getByTitle(hostedFolder, { exact: true }).click();
    await turnButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Hosted turn text', { exact: true })).toBeVisible(PROMPTLY);
    await expect(panel(page).getByText('Running', { exact: true })).toBeVisible();
    await turnButton(page).click();
    await expect(panel(page)).toHaveCount(0);

    await expect(entry(page, externalFolder)).toBeVisible({ timeout: 20_000 });
    await entry(page, externalFolder).getByTitle(externalFolder, { exact: true }).click();
    await expect(page.locator('.conversation-view')).toContainText('Looking at the batch');
    await header(page).locator('.mono-chip').first().focus();
    for (let i = 0; i < 200 && !(await turnButton(page).evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
    await expect(turnButton(page), 'reached with Tab').toBeFocused();
    expect(await focusedShowsRing(page), '"Turn Panel" shows the focus ring').toBe(true);
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('article', { name: 'Subagent: sdd-developer', exact: true })).toBeVisible(PROMPTLY);

    for (let i = 0; i < 100 && !(await focusInPanel(page)); i += 1) await page.keyboard.press('Tab');
    expect(await focusInPanel(page), 'reached the panel with Tab').toBe(true);
    for (let i = 0; i < 10 && (await focusInPanel(page)); i += 1) {
      expect(await focusedShowsRing(page), 'each focused element of the panel shows the focus ring').toBe(true);
      await page.keyboard.press('Tab');
    }
  });
});
