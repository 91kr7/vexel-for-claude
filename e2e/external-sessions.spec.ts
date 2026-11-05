// e2e of plan-claude_sessions_client, batch external-sessions. Each external session is a live `sleep` process with its fixture files in E2E_CLAUDE_DIR.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const TOOLTIP = 'Sessione in un altro terminale: lo stato «Richiede input» non è disponibile';
const TIME = /\d{2}:\d{2}:\d{2}/;
// The scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
const terminals: ChildProcess[] = [];
const startedIds: string[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-external-'));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('navigation', { name: 'Elenco sessioni' });
const listEntry = (page: Page, folder: string) => list(page).getByRole('button').filter({ hasText: folder });
const counter = (page: Page) => page.getByRole('status').filter({ hasText: 'Richiede input:' });
const conversationView = (page: Page) => page.locator('.conversation-view');
const items = (page: Page) => conversationView(page).getByRole('article');
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Sessione in esecuzione in un terminale' });
const terminal = (page: Page) => page.locator('.xterm-rows');
const isResumeRequest = (url: string, method: string) => /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(url).pathname) && method === 'POST';

interface ExternalTerminal {
  update(fields: { status?: string; updatedAt?: number }): Promise<void>;
  end(): void;
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

const transcriptPath = (folder: string, id: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`);
const jsonLines = (entries: object[]) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('');
const user = (folder: string, content: unknown) => ({ type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content } });
const assistant = (folder: string, content: unknown[]) => ({ type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content } });

async function writeTranscript(folder: string, id: string, entries: object[]): Promise<string> {
  const file = transcriptPath(folder, id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, jsonLines(entries));
  return file;
}

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO next to it. */
async function runInTerminal(sessionId: string, folder: string, status = 'idle'): Promise<ExternalTerminal> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  execFileSync('mkfifo', [path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`)]);
  let data = { pid, sessionId, cwd: folder, kind: 'interactive', status, updatedAt: Date.now() };
  const write = () => writeFile(path.join(SESSIONS_DIR, `${pid}.json`), JSON.stringify(data));
  await write();
  return {
    update: async (fields) => {
      data = { ...data, ...fields };
      await write();
    },
    end: () => process.kill('SIGKILL'),
  };
}

/** Content and modification time of every regular file of the fixture folder. */
async function snapshotFixture(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(E2E_CLAUDE_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    result[full] = `${(await stat(full)).mtimeMs}:${await readFile(full, 'utf8')}`;
  }
  return result;
}

async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => Object.assign(globalThis, { e2eSamePage: true }));
}

async function expectNoReload(page: Page): Promise<void> {
  expect(await page.evaluate(() => 'e2eSamePage' in globalThis)).toBe(true);
}

// plan-claude_sessions_client/REQ-29, REQ-30, REQ-31 — scenario "The user sees a session that runs in another terminal"
test('a session that runs in another terminal is listed as external with its folder, first message, state and time', async ({ page }) => {
  const folder = await newFolder('shop');
  const firstMessage = `Aggiorna la pagina del carrello e ${'aggiungi i test '.repeat(6)}`;
  await writeTranscript(folder, 'e2e-ext-shop', [user(folder, firstMessage), assistant(folder, [{ type: 'text', text: 'Fatto.' }])]);
  await runInTerminal('e2e-ext-shop', folder);

  await page.goto('/');

  const entry = listEntry(page, folder);
  await expect(entry).toBeVisible(SCAN);
  await expect(entry).toContainText(firstMessage.replace(/\s+/g, ' ').trim().slice(0, 80));
  await expect(entry).toContainText('In attesa');
  await expect(entry).toContainText(TIME);
  await expect(entry).toHaveClass(/\bexternal\b/);
  const marker = entry.getByText('Esterna', { exact: true });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('title', TOOLTIP);
});

// plan-claude_sessions_client/REQ-31, REQ-32 — scenario "The external state follows the terminal"
test('the external state follows the terminal without a reload', async ({ page }) => {
  const folder = await newFolder('blog');
  const session = await runInTerminal('e2e-ext-blog', folder, 'idle');

  await page.goto('/');
  const entry = listEntry(page, folder);
  await expect(entry).toContainText('In attesa', SCAN);
  await markNoReload(page);

  await session.update({ status: 'busy', updatedAt: Date.now() });
  await expect(entry).toContainText('In lavorazione', SCAN);
  await session.update({ status: 'idle', updatedAt: Date.now() });
  await expect(entry).toContainText('In attesa', SCAN);
  await expectNoReload(page);
});

// plan-claude_sessions_client/REQ-31 — scenario "A waiting external session shows as working"
test('an external session that waits for a permission answer shows as working and is not counted as needing input', async ({ page }) => {
  const folder = await newFolder('permission');
  await runInTerminal('e2e-ext-permission', folder, 'busy');

  await page.goto('/');
  const entry = listEntry(page, folder);
  await expect(entry).toContainText('In lavorazione', SCAN);
  await expect(entry).not.toContainText('Richiede input');
  await expect(entry).not.toHaveClass(/\bneeds-input\b/);
  await expect(counter(page)).toBeVisible();
  const needsInputEntries = list(page).locator('.session-entry.needs-input');
  await expect
    .poll(async () => (await counter(page).textContent()) === `Richiede input: ${await needsInputEntries.count()}`)
    .toBe(true);
});

// plan-claude_sessions_client/REQ-32 — scenario "An external session leaves the list when it ends"
test('an external session leaves the list when its terminal process ends, without a reload', async ({ page }) => {
  const folder = await newFolder('ending');
  const session = await runInTerminal('e2e-ext-ending', folder);

  await page.goto('/');
  await expect(listEntry(page, folder)).toBeVisible(SCAN);
  await markNoReload(page);

  session.end();
  await expect(listEntry(page, folder)).toHaveCount(0, SCAN);
  await expectNoReload(page);
});

// plan-claude_sessions_client/REQ-33, REQ-34, REQ-36 — scenario "The user follows an external session"
test('a click on an external entry shows its conversation read-only, updated live, and the client writes nothing', async ({ page }) => {
  const folder = await newFolder('api');
  const transcript = await writeTranscript(folder, 'e2e-ext-api', [
    user(folder, 'Elenca i file del progetto'),
    assistant(folder, [
      { type: 'thinking', thinking: 'non mostrare' },
      { type: 'text', text: 'Li elenco subito.' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls -la src' } },
    ]),
    user(folder, [{ type: 'tool_result', tool_use_id: 't1', content: 'uno\ndue\ntre\nquattro\ncinque\nsei\nsette' }]),
  ]);
  const session = await runInTerminal('e2e-ext-api', folder, 'busy');
  const sentFrames: string[] = [];
  page.on('websocket', (socket) => {
    if (socket.url().includes('/conversation')) socket.on('framesent', (frame) => sentFrames.push(String(frame.payload)));
  });

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);

  await expect(items(page)).toHaveCount(4);
  await expect(items(page).nth(0).getByRole('heading')).toHaveText('Utente');
  await expect(items(page).nth(0)).toContainText('Elenca i file del progetto');
  await expect(items(page).nth(1).getByRole('heading')).toHaveText('Claude');
  await expect(items(page).nth(1)).toContainText('Li elenco subito.');
  await expect(items(page).nth(2).getByRole('heading')).toHaveText('Strumento: Bash');
  await expect(items(page).nth(2)).toContainText('ls -la src');
  await expect(items(page).nth(3).getByRole('heading')).toHaveText('Risultato');
  await expect(items(page).nth(3).locator('pre')).toHaveText('uno\ndue\ntre\nquattro\ncinque\n…');
  await expect(conversationView(page)).not.toContainText('non mostrare');
  await expect(page.locator('.session-area').getByRole('textbox')).toHaveCount(0);
  await expect(terminal(page)).toHaveCount(0);

  await appendFile(
    transcript,
    jsonLines([
      assistant(folder, [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/src/main.ts' } }]),
      assistant(folder, [{ type: 'text', text: 'Il file principale è main.ts.' }]),
    ]),
  );
  await expect(items(page)).toHaveCount(6);
  await expect(items(page).nth(4)).toContainText('Strumento: Read');
  await expect(items(page).nth(4)).toContainText('/src/main.ts');
  await expect(items(page).nth(5)).toContainText('Il file principale è main.ts.');
  await expect(items(page).nth(5)).toBeInViewport();

  const before = await snapshotFixture();
  await page.waitForTimeout(2500);
  expect(await snapshotFixture()).toEqual(before);
  expect(sentFrames).toEqual([]);

  session.end();
  await expect(listEntry(page, folder)).toHaveCount(0, SCAN);
  await expect(items(page)).toHaveCount(6);
});

// plan-claude_sessions_client/REQ-30, REQ-33, REQ-34: a new session has no message yet
test('an external session with no message yet is labelled with its folder name and shows its first message once written', async ({ page }) => {
  const folder = await newFolder('fresh-start');
  await runInTerminal('e2e-ext-fresh', folder);

  await page.goto('/');
  const entry = listEntry(page, folder);
  await expect(entry).toContainText('fresh-start', SCAN);
  await entry.click();
  await expect(conversationView(page)).toContainText('Nessun messaggio.');

  await writeTranscript(folder, 'e2e-ext-fresh', [user(folder, 'Il primo messaggio')]);
  await expect(items(page)).toHaveCount(1, SCAN);
  await expect(items(page).first()).toContainText('Il primo messaggio');
  await expect(conversationView(page)).not.toContainText('Nessun messaggio.');
  await expect(entry).toContainText('Il primo messaggio', SCAN);
});

// plan-claude_sessions_client/REQ-35 — scenario "The user takes over an external session"
test('"Riprendi qui" warns first, then resumes the external session in the client terminal', async ({ page }) => {
  const folder = await newFolder('takeover');
  await writeTranscript(folder, 'e2e-ext-takeover', [user(folder, 'Riprendimi nel client'), assistant(folder, [{ type: 'text', text: 'Pronto.' }])]);
  await runInTerminal('e2e-ext-takeover', folder);
  const resumeRequests: string[] = [];
  page.on('request', (r) => {
    if (isResumeRequest(r.url(), r.method())) resumeRequests.push(r.url());
  });

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);
  await expect(items(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Riprendi qui' }).click();
  await expect(warning(page)).toBeVisible();
  await warning(page).getByRole('button', { name: 'Annulla' }).click();
  await expect(warning(page)).toBeHidden();
  await expect(conversationView(page)).toBeVisible();
  expect(resumeRequests).toEqual([]);

  await page.getByRole('button', { name: 'Riprendi qui' }).click();
  const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));
  await warning(page).getByRole('button', { name: 'Riprendi comunque' }).click();
  const response = await resumed;
  expect(response.status()).toBe(201);
  startedIds.push(((await response.json()) as { id: string }).id);
  expect(new URL(response.url()).pathname).toBe('/api/past-sessions/e2e-ext-takeover/resume');

  await expect(warning(page)).toBeHidden();
  await expect(terminal(page)).toContainText('"--resume","e2e-ext-takeover"');
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(conversationView(page)).toHaveCount(0);
  expect(resumeRequests).toHaveLength(1);
});

// plan-claude_sessions_client/REQ-35: a failed resume shows an error and opens nothing
test('"Riprendi qui" on a session whose transcript disappeared shows an error and keeps the conversation open', async ({ page }) => {
  const folder = await newFolder('vanished');
  const transcript = await writeTranscript(folder, 'e2e-ext-vanished', [user(folder, 'Sparirò')]);
  await runInTerminal('e2e-ext-vanished', folder);

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);
  await expect(items(page)).toHaveCount(1);
  await rm(transcript);

  await page.getByRole('button', { name: 'Riprendi qui' }).click();
  await warning(page).getByRole('button', { name: 'Riprendi comunque' }).click();
  await expect(page.getByRole('alert')).toHaveText('La sessione non esiste più.');
  await expect(conversationView(page)).toBeVisible();
  await expect(terminal(page)).toHaveCount(0);
});
