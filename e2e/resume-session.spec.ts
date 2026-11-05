// e2e of plan-claude_sessions_client, batch resume-session. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;
const startedIds: string[] = [];
const terminals: ChildProcess[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-resume-'));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Riprendi sessione' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Sessione in esecuzione in un terminale' });
const pastEntry = (page: Page, folder: string, label: string) =>
  dialog(page).getByRole('region', { name: folder }).getByRole('button').filter({ hasText: label });
const listEntry = (page: Page, label: string) => page.getByRole('navigation', { name: 'Elenco sessioni' }).getByRole('button').filter({ hasText: label });
const terminal = (page: Page) => page.locator('.xterm-rows');
const isResumeRequest = (url: string, method: string) => /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(url).pathname) && method === 'POST';

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

/** Writes a session as Claude Code leaves it after a session in the terminal. */
async function pastSession(id: string, folder: string, firstMessage: string, modified: Date): Promise<string> {
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: firstMessage } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Fatto.' }] } },
  ];
  const file = path.join(dir, `${id}.jsonl`);
  await writeFile(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  await utimes(file, modified, modified);
  return file;
}

/** Simulates Claude Code running the session in a terminal: a live process with its `sessions/<pid>.json`. */
async function runInTerminal(sessionId: string): Promise<void> {
  const process = spawn('sleep', ['120'], { stdio: 'ignore' });
  terminals.push(process);
  await mkdir(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true });
  await writeFile(path.join(E2E_CLAUDE_DIR, 'sessions', `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId }));
}

async function openDialog(page: Page): Promise<void> {
  await page.getByRole('complementary').getByRole('button', { name: 'Riprendi sessione' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).not.toContainText('Caricamento…');
}

async function choose(page: Page, folder: string, label: string): Promise<string> {
  const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));
  await pastEntry(page, folder, label).click();
  const response = await resumed;
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  startedIds.push(id);
  return id;
}

// plan-claude_sessions_client/REQ-25
test('with no past session the dialog says so, and "Annulla" closes it', async ({ page }) => {
  await page.goto('/');
  await openDialog(page);
  await expect(dialog(page)).toContainText('Nessuna sessione da riprendere.');
  await dialog(page).getByRole('button', { name: 'Annulla' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
});

// plan-claude_sessions_client/REQ-13, REQ-25, REQ-26 — scenario "The user resumes a session started in the terminal"
test('the user resumes a session started in the terminal, chosen under its folder', async ({ page }) => {
  const shop = await newFolder('shop');
  const blog = await newFolder('blog');
  const firstMessage = `Aggiorna la pagina del carrello e ${'aggiungi i test '.repeat(6)}`;
  const label = firstMessage.replace(/\s+/g, ' ').trim().slice(0, 80);
  await pastSession('e2e-shop-old', shop, 'Sessione più vecchia', new Date('2026-10-20T10:00:00Z'));
  await pastSession('e2e-shop', shop, firstMessage, new Date('2026-10-25T10:00:00Z'));
  await pastSession('e2e-blog', blog, 'Scrivi un articolo', new Date('2026-10-22T10:00:00Z'));

  await page.goto('/');
  await openDialog(page);
  const groups = dialog(page).getByRole('region');
  await expect(groups.getByRole('heading')).toHaveText([shop, blog]);
  const shopEntries = dialog(page).getByRole('region', { name: shop }).getByRole('button');
  await expect(shopEntries).toHaveCount(2);
  await expect(shopEntries.first()).toContainText(label);
  await expect(shopEntries.first()).toContainText(/25\/10\/2026/);
  await expect(shopEntries.nth(1)).toContainText('Sessione più vecchia');

  await choose(page, shop, label);

  await expect(dialog(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${shop}`);
  await expect(terminal(page)).toContainText('"--resume","e2e-shop"');
  await expect(listEntry(page, label)).toBeVisible();
});

// plan-claude_sessions_client/REQ-27 — scenario "The session still runs in a terminal"
test('a session still running in a terminal resumes only after "Riprendi comunque"', async ({ page }) => {
  const api = await newFolder('api');
  await pastSession('e2e-running', api, 'Rifattorizza il router', new Date('2026-10-26T10:00:00Z'));
  await runInTerminal('e2e-running');
  const resumeRequests: string[] = [];
  page.on('request', (r) => {
    if (isResumeRequest(r.url(), r.method())) resumeRequests.push(r.url());
  });

  await page.goto('/');
  await openDialog(page);
  const entry = pastEntry(page, api, 'Rifattorizza il router');
  await expect(entry).toContainText('In esecuzione in un terminale');

  await entry.click();
  await expect(warning(page)).toBeVisible();
  await expect(warning(page)).toContainText('le due istanze possono danneggiare la conversazione');
  await expect(warning(page).getByRole('button', { name: 'Annulla' })).toBeFocused();
  await warning(page).getByRole('button', { name: 'Annulla' }).click();
  await expect(warning(page)).toBeHidden();
  await expect(dialog(page)).toBeVisible();
  expect(resumeRequests).toEqual([]);

  await entry.click();
  const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));
  await warning(page).getByRole('button', { name: 'Riprendi comunque' }).click();
  const response = await resumed;
  expect(response.status()).toBe(201);
  startedIds.push(((await response.json()) as { id: string }).id);
  await expect(warning(page)).toBeHidden();
  await expect(dialog(page)).toBeHidden();
  await expect(terminal(page)).toContainText('"--resume","e2e-running"');
  expect(resumeRequests).toHaveLength(1);
});

// plan-claude_sessions_client/REQ-25: errors stay in the dialog and open no session
test('a session or a folder that disappeared after the dialog opened shows an error and opens nothing', async ({ page }) => {
  const docs = await newFolder('docs');
  const tools = await newFolder('tools');
  const vanishing = await pastSession('e2e-vanishing', docs, 'Sessione cancellata', new Date('2026-10-27T10:00:00Z'));
  await pastSession('e2e-no-folder', tools, 'Cartella cancellata', new Date('2026-10-28T10:00:00Z'));

  await page.goto('/');
  await openDialog(page);
  await rm(vanishing);
  await rm(tools, { recursive: true });

  await pastEntry(page, docs, 'Sessione cancellata').click();
  await expect(dialog(page).getByRole('alert')).toHaveText('La sessione non esiste più.');
  await pastEntry(page, tools, 'Cartella cancellata').click();
  await expect(dialog(page).getByRole('alert')).toHaveText('La cartella del progetto non esiste.');
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
});
