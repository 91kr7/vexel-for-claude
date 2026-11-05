// e2e of plan-claude_sessions_client-ui_redesign, batch open-session: the read-only view of an external session.
// Each external session is a live `sleep` process with its fixture files in E2E_CLAUDE_DIR.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Box = { x: number; y: number; width: number; height: number };

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const ONE_SECOND = { timeout: 1000 };

let projectsRoot: string;
const terminals: ChildProcess[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-open-external-'));
});

test.afterEach(async () => {
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const listEntry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const view = (page: Page) => page.locator('.conversation-view');
const header = (page: Page) => view(page).locator('.session-header');
const scroller = (page: Page) => view(page).locator('.conversation-items');
const items = (page: Page) => view(page).getByRole('article');
const itemWithHeading = (page: Page, heading: string) => items(page).filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
const expandButton = (item: Locator) => item.getByRole('button', { name: 'Espandi' });
const collapseButton = (item: Locator) => item.getByRole('button', { name: 'Comprimi' });
const isItemRequest = (url: string) => /\/api\/external-sessions\/[^/]+\/items$/.test(new URL(url).pathname);

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

const transcriptPath = (folder: string, id: string) => path.join(E2E_CLAUDE_DIR, 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`);
const jsonLines = (entries: object[]) => entries.map((entry) => `${JSON.stringify(entry)}\n`).join('');
const user = (folder: string, content: unknown) => ({ type: 'user', cwd: folder, isSidechain: false, message: { role: 'user', content } });
const assistant = (folder: string, content: unknown[]) => ({ type: 'assistant', cwd: folder, isSidechain: false, message: { role: 'assistant', content } });
const reply = (folder: string, text: string) => assistant(folder, [{ type: 'text', text }]);
const toolUse = (folder: string, id: string, name: string, input: object) => assistant(folder, [{ type: 'tool_use', id, name, input }]);
const toolResult = (folder: string, id: string, content: string) => user(folder, [{ type: 'tool_result', tool_use_id: id, content }]);
const lines = (count: number, prefix = 'riga') => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`).join('\n');
/** User and Claude messages, enough to make the conversation scroll. */
const chatter = (folder: string, pairs: number) =>
  Array.from({ length: pairs }, (_, i) => [user(folder, `Domanda numero ${i + 1}`), reply(folder, `Risposta numero ${i + 1}\n${lines(3, 'dettaglio')}`)]).flat();

async function writeTranscript(folder: string, id: string, entries: object[]): Promise<string> {
  const file = transcriptPath(folder, id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, jsonLines(entries));
  return file;
}

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO next to it. */
async function runInTerminal(sessionId: string, folder: string, status = 'idle'): Promise<ChildProcess> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  terminals.push(process);
  const pid = process.pid ?? 0;
  execFileSync('mkfifo', [path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`)]);
  await writeFile(path.join(SESSIONS_DIR, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status, updatedAt: Date.now() }));
  return process;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** Background and border of an item: what makes its look. */
const lookOf = (item: Locator) =>
  item.evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.backgroundColor}|${style.borderTopStyle} ${style.borderTopWidth}|${style.borderLeftStyle} ${style.borderLeftWidth}`;
  });

const scrollTop = (page: Page) => scroller(page).evaluate((el) => el.scrollTop);
const scrollTo = (page: Page, where: 'top' | number) =>
  scroller(page).evaluate((el, target) => {
    el.scrollTop = target === 'top' ? 0 : el.scrollHeight - el.clientHeight - target;
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, where);

// plan-claude_sessions_client-ui_redesign/REQ-17, REQ-19, REQ-20 — scenario "The user reads an external session"
test('the external view shows its header, a read-only notice that stays in view, and one look per item kind', async ({ page }) => {
  const folder = await newFolder('negozio');
  await writeTranscript(folder, 'e2e-open-read', [
    user(folder, 'Sistema il carrello del negozio'),
    reply(folder, 'Controllo il codice.'),
    toolUse(folder, 't1', 'Read', { file_path: '/src/cart.ts' }),
    toolResult(folder, 't1', 'export const cart = [];'),
    ...chatter(folder, 30),
  ]);
  const process = await runInTerminal('e2e-open-read', folder);
  await page.setViewportSize({ width: 1920, height: 800 });

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);

  // SessionHeader: the h2 is the folder name, the line is "<label> · <folder>".
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('negozio');
  await expect(header(page)).toContainText('In attesa');
  await expect(header(page).getByText(`Sistema il carrello del negozio · ${folder}`, { exact: true })).toBeVisible();
  await expect(header(page).getByRole('button', { name: 'Riprendi qui' })).toBeVisible();
  const notice = header(page).getByText('Sola lettura', { exact: true });
  await expect(notice).toBeVisible();
  await expect(items(page).last()).toBeInViewport();

  // REQ-20: each kind has its own look, and the text sits in a centred column narrower than the list.
  const userItem = itemWithHeading(page, 'Utente').first();
  const claudeItem = itemWithHeading(page, 'Claude').first();
  const toolItem = itemWithHeading(page, 'Strumento: Read');
  await expect(toolItem).toContainText('/src/cart.ts');
  await expect(toolItem.locator('svg').first()).toBeAttached();
  const looks = [await lookOf(userItem), await lookOf(claudeItem), await lookOf(toolItem)];
  expect(new Set(looks).size).toBe(3);
  const listBox = await box(scroller(page));
  const itemBox = await box(claudeItem);
  expect(itemBox.width).toBeLessThan(listBox.width * 0.75);
  const leftGap = itemBox.x - listBox.x;
  const rightGap = listBox.x + listBox.width - (itemBox.x + itemBox.width);
  // The scrollbar may take some width on the right.
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(20);

  // REQ-19: the header and its notice stay in place while the list scrolls.
  const headerBefore = await box(header(page));
  await scrollTo(page, 'top');
  await expect(items(page).first()).toBeInViewport();
  await expect(notice).toBeInViewport();
  expect(await box(header(page))).toEqual(headerBefore);

  // The header keeps the last known data after the entry leaves the list.
  process.kill('SIGKILL');
  await expect(listEntry(page, folder)).toHaveCount(0, SCAN);
  await expect(header(page).getByRole('heading', { level: 2 })).toHaveText('negozio');
  await expect(header(page).getByText(`Sistema il carrello del negozio · ${folder}`, { exact: true })).toBeVisible();
  await expect(notice).toBeVisible();
});

// plan-claude_sessions_client-ui_redesign/REQ-21, REQ-4 — scenario "The user expands a long tool output"
test('tool calls and long tool outputs are collapsed, expand to their full content on demand and collapse again', async ({ page }) => {
  const folder = await newFolder('espandi');
  const input = { command: 'npm run build -- --mode production', description: 'Compila il progetto' };
  await writeTranscript(folder, 'e2e-open-expand', [
    user(folder, 'Compila e controlla'),
    toolUse(folder, 't1', 'Bash', input),
    toolResult(folder, 't1', lines(8)),
    toolUse(folder, 't2', 'Read', { file_path: '/src/a.ts' }),
    toolResult(folder, 't2', lines(3, 'breve')),
  ]);
  await runInTerminal('e2e-open-expand', folder);
  const itemRequests: string[] = [];
  page.on('request', (request) => {
    if (isItemRequest(request.url())) itemRequests.push(request.url());
  });

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);
  await expect(items(page)).toHaveCount(5);
  const call = itemWithHeading(page, 'Strumento: Bash');
  const [longResult, shortResult] = [itemWithHeading(page, 'Risultato').nth(0), itemWithHeading(page, 'Risultato').nth(1)];

  // Collapsed: the call is its one-line summary, the long output its first 5 lines and "…", the short output has no button.
  await expect(call).toContainText(input.command);
  await expect(call.locator('pre')).toHaveCount(0);
  await expect(expandButton(call)).toHaveAttribute('aria-expanded', 'false');
  await expect(longResult.locator('pre')).toHaveText(`${lines(5)}\n…`);
  await expect(expandButton(longResult)).toHaveAttribute('aria-expanded', 'false');
  await expect(shortResult.getByRole('button')).toHaveCount(0);
  await expect(shortResult.locator('pre')).toHaveText(lines(3, 'breve'));
  expect(itemRequests).toEqual([]);

  await expandButton(longResult).click();
  await expect(longResult.locator('pre')).toHaveText(lines(8));
  await expect(collapseButton(longResult)).toHaveAttribute('aria-expanded', 'true');
  expect(itemRequests).toHaveLength(1);
  await collapseButton(longResult).click();
  await expect(longResult.locator('pre')).toHaveText(`${lines(5)}\n…`);
  await expect(expandButton(longResult)).toHaveAttribute('aria-expanded', 'false');

  // The keyboard alone expands and collapses the call.
  await expandButton(call).focus();
  await page.keyboard.press('Enter');
  await expect(call.locator('pre')).toHaveText(JSON.stringify(input, null, 2));
  await expect(collapseButton(call)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(call.locator('pre')).toHaveCount(0);
  await expect(expandButton(call)).toHaveAttribute('aria-expanded', 'false');
  expect(itemRequests).toHaveLength(2);

  // Later expands reuse the loaded content.
  await expandButton(longResult).click();
  await expect(longResult.locator('pre')).toHaveText(lines(8));
  await expandButton(call).click();
  await expect(call.locator('pre')).toHaveText(JSON.stringify(input, null, 2));
  expect(itemRequests).toHaveLength(2);
});

// plan-claude_sessions_client-ui_redesign/REQ-21, plan-claude_sessions_client-ui_redesign/REQ-30: load and failure of the full content
test('the full content shows "Caricamento…" while it loads, an error when it fails, and loads again on the next expand', async ({ page }) => {
  const folder = await newFolder('errore');
  await writeTranscript(folder, 'e2e-open-failure', [user(folder, 'Mostra il log'), toolUse(folder, 't1', 'Bash', { command: 'cat log' }), toolResult(folder, 't1', lines(9))]);
  await runInTerminal('e2e-open-failure', folder);
  let attempts = 0;
  await page.route(
    (url) => isItemRequest(url.href),
    async (route) => {
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.continue();
    },
  );

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);
  const result = itemWithHeading(page, 'Risultato');
  await expect(result.locator('pre')).toHaveText(`${lines(5)}\n…`);

  await expandButton(result).click();
  await expect(result).toContainText('Impossibile caricare il contenuto completo.');
  await collapseButton(result).click();
  await expect(result).not.toContainText('Impossibile caricare il contenuto completo.');

  await expandButton(result).click();
  await expect(result).toContainText('Caricamento…');
  await expect(result.locator('pre')).toHaveText(lines(9));
  await expect(result).not.toContainText('Caricamento…');
  expect(attempts).toBe(2);
});

// plan-claude_sessions_client-ui_redesign/REQ-22, REQ-23 — scenario "The user reads earlier content while the session runs"
test('new content follows the end of the conversation, and does not move the view while the user reads earlier content', async ({ page }) => {
  const folder = await newFolder('segui');
  const transcript = await writeTranscript(folder, 'e2e-open-follow', chatter(folder, 30));
  await runInTerminal('e2e-open-follow', folder, 'busy');
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto('/');
  await listEntry(page, folder).click(SCAN);
  await expect(items(page)).toHaveCount(60);
  await expect(items(page).last()).toBeInViewport();

  // Scrolled up: the view does not move.
  await scrollTo(page, 'top');
  const firstBefore = await box(items(page).first());
  await appendFile(transcript, jsonLines([reply(folder, 'Nuovo messaggio uno')]));
  await expect(items(page)).toHaveCount(61, SCAN);
  await page.waitForTimeout(300);
  expect(await scrollTop(page)).toBe(0);
  expect(await box(items(page).first())).toEqual(firstBefore);
  await expect(items(page).last()).not.toBeInViewport();

  // Back at the end: the next message comes into view by itself.
  await scrollTo(page, 0);
  await appendFile(transcript, jsonLines([reply(folder, 'Nuovo messaggio due')]));
  await expect(items(page)).toHaveCount(62, SCAN);
  await expect(items(page).last()).toContainText('Nuovo messaggio due');
  await expect(items(page).last()).toBeInViewport();

  // A few pixels from the end still counts as the end.
  await scrollTo(page, 5);
  await appendFile(transcript, jsonLines([reply(folder, 'Nuovo messaggio tre')]));
  await expect(items(page)).toHaveCount(63, SCAN);
  await expect(items(page).last()).toBeInViewport();
});

// plan-claude_sessions_client-ui_redesign/REQ-24: large tool outputs do not slow the opening
test('with 10 active sessions, a transcript with large outputs opens, and the view switches, within one second', async ({ page }) => {
  const big = await newFolder('grande');
  const bigEntries = [user(big, 'Analizza i log')];
  for (let i = 1; i <= 30; i += 1) {
    bigEntries.push(toolUse(big, `t${i}`, 'Bash', { command: `cat log-${i}.txt` }));
    bigEntries.push(toolResult(big, `t${i}`, lines(3000, `riga di log molto lunga del file ${i}, numero`)));
  }
  bigEntries.push(reply(big, 'Fine analisi dei log.'));
  await writeTranscript(big, 'e2e-open-big', bigEntries);
  await runInTerminal('e2e-open-big', big);
  const small = await newFolder('piccola');
  await writeTranscript(small, 'e2e-open-small', [user(small, 'Ciao'), reply(small, 'Ciao, dimmi pure.')]);
  await runInTerminal('e2e-open-small', small);
  for (let i = 1; i <= 8; i += 1) await runInTerminal(`e2e-open-other-${i}`, await newFolder(`altra-${i}`));

  await page.goto('/');
  await expect(list(page).getByRole('button').filter({ has: page.locator(`[title^="${projectsRoot}"]`) })).toHaveCount(10, SCAN);

  await listEntry(page, big).click();
  await expect(items(page).last()).toContainText('Fine analisi dei log.', ONE_SECOND);
  await expect(items(page).last()).toBeInViewport(ONE_SECOND);

  await listEntry(page, small).click();
  await expect(items(page).last()).toContainText('Ciao, dimmi pure.', ONE_SECOND);

  await listEntry(page, big).click();
  await expect(items(page).last()).toContainText('Fine analisi dei log.', ONE_SECOND);
});
