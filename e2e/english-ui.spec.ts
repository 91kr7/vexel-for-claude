// e2e of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui, batch english-ui.
// The server runs the fake CLI (playwright.config.ts).
/// <reference lib="dom" />
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
const createdIds: string[] = [];

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-english-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

const topBar = (page: Page) => page.getByRole('banner');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => panel(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const pathField = (page: Page) => chooser(page).getByRole('textbox', { name: 'Working Directory Path' });
const terminal = (page: Page) => page.locator('.xterm-rows');

/** Words and letters of the former Italian UI; none of them belongs to the English UI. */
const ITALIAN =
  /\b(?:sessione|sessioni|nuova|riprendi|annulla|apri|interrompi|termina|terminata|terminare|rispondi|caricamento|cartella|cartelle|recenti|chiudi|lavora|richiede|richiedono|attesa|corso|esterna|lettura|maiusc|elenco|terminale|utente|strumento|risultato|fatto|fallito|nuovi|nuovo|messaggi|messaggio|nessun|nessuna|impossibile|riuscito|riuscita|connessione|inserisci|leggibile|permesso|esecuzione|aperta|disconnessa|conversazione|scegli|torna|progetto|progetti|passate|ancora|avvia|navigazione|principale|percorso|assoluto|tuo|ora|fa|il|della|del|di|non|per|una)\b|[àèéìòù]/gi;

/** Visible text and accessible labels of the page, terminal output excluded: Claude Code writes it, not the client. */
async function uiText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.title];
    const visit = (el: Element) => {
      if (el.classList.contains('xterm')) return;
      for (const name of ['aria-label', 'title', 'placeholder', 'aria-description', 'alt']) {
        const value = el.getAttribute(name);
        if (value) parts.push(value);
      }
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && el.checkVisibility()) parts.push(child.textContent ?? '');
        else if (child instanceof Element) visit(child);
      }
    };
    visit(document.body);
    return parts.join('\n');
  });
}

async function expectNoItalian(page: Page, where: string): Promise<void> {
  const text = await uiText(page);
  expect(text.match(ITALIAN) ?? [], `Italian words ${where}`).toEqual([]);
}

/** Shows in the page only the sessions of this test: the reused server holds sessions of other tests and earlier runs. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(projectsRoot + path.sep);
  await page.route(
    (url) => url.pathname === '/api/sessions',
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const sessions = (await response.json()) as { folder?: unknown }[];
      await route.fulfill({ response, json: sessions.filter(own) });
    },
  );
  await page.routeWebSocket(/\/api\/sessions\/events$/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((message) => {
      const frame = JSON.parse(String(message)) as { type?: string; session?: { folder?: unknown } };
      if (frame.type !== 'session' || own(frame.session)) ws.send(message);
    });
  });
}

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

async function startViaApi(request: APIRequestContext, folder: string): Promise<string> {
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  createdIds.push(id);
  return id;
}

async function postHook(request: APIRequestContext, id: string, event: Record<string, string>): Promise<void> {
  const response = await request.post(`/api/sessions/${id}/hook-events`, { data: event });
  expect(response.status()).toBe(204);
}

/** Whether the text of `target` stays on one line, inside its own box and inside `container`. */
async function fitsInside(target: Locator, container: Locator): Promise<{ oneLine: boolean; noOverflow: boolean; inContainer: boolean }> {
  const handle = await container.elementHandle();
  return target.evaluate((el, outer) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    const box = (outer as Element).getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5;
    return {
      oneLine: text.height <= lineHeight * 1.5,
      noOverflow: el.scrollWidth <= el.clientWidth + 0.5 && text.left >= own.left - 0.5 && text.right <= own.right + 0.5,
      inContainer: own.left >= box.left - 0.5 && own.right <= box.right + 0.5,
    };
  }, handle);
}

async function expectFits(target: Locator, container: Locator, what: string): Promise<void> {
  await expect(target, what).toBeVisible();
  expect(await fitsInside(target, container), what).toEqual({ oneLine: true, noOverflow: true, inContainer: true });
}

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-10, REQ-11 — scenario "The page declares English"
test('the page declares English and the tab title is "Vexel for Claude"', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Vexel for Claude');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1, REQ-3, REQ-5, REQ-9, REQ-14: the empty page
test('the empty page shows the English frame, empty state and accessible names', async ({ page }) => {
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await expect(topBar(page).getByRole('button', { name: 'New Session', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: 'Sessions', exact: true })).toBeVisible();
  await expect(panel(page)).toContainText('No sessions.');
  const main = page.getByRole('main');
  await expect(main).toContainText('No open session.');
  await expect(main).toContainText('Start a new session or resume a past one.');
  await expect(main.getByRole('button', { name: 'New Session', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Resume Session', exact: true })).toBeVisible();
  await expectNoItalian(page, 'on the empty page');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3, REQ-4, REQ-9, REQ-13 — scenario "The user starts a session from English dialogs"
test('"New Session" opens the English new-session dialog, and the rail and the close control have English names', async ({ page }) => {
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await expect(railButton(page, 'New Claude Code Session')).toBeVisible();
  await expect(railButton(page, 'Sessions')).toBeVisible();
  await expect(railButton(page, 'Resume')).toBeVisible();

  await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
  await expect(chooser(page)).toBeVisible();
  await expect(chooser(page).getByRole('heading', { name: 'New Claude Code Session', exact: true })).toBeVisible();
  await expect(pathField(page)).toBeVisible();
  await expect(chooser(page).getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(chooser(page).getByRole('button', { name: 'Start Session', exact: true })).toBeVisible();
  await expect(chooser(page).getByRole('button', { name: 'Close (Esc)', exact: true })).toBeVisible();
  await expect(chooser(page)).toContainText('Choose the project where Claude Code starts.');
  await expect(chooser(page).getByRole('form', { name: 'Choose the Project Folder' })).toBeVisible();
  await expect(chooser(page).getByText('Folders', { exact: true })).toBeVisible();
  await expectNoItalian(page, 'in the new-session dialog');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5, REQ-14 — scenario "The user sees an error in English"
test('a relative path and a missing folder show English errors in the new-session dialog', async ({ page }) => {
  await showOnlyOwnSessions(page);
  await page.goto('/');
  await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
  await expect(pathField(page)).toBeVisible();

  await pathField(page).fill('relative/project');
  await pathField(page).press('Enter');
  await expect(chooser(page).getByRole('alert')).toHaveText('Enter an absolute path.');
  await expectNoItalian(page, 'with the relative-path error');

  await pathField(page).fill(path.join(projectsRoot, 'missing'));
  await pathField(page).press('Enter');
  await expect(chooser(page).getByRole('alert')).toHaveText('The folder does not exist.');
  await expectNoItalian(page, 'with the missing-folder error');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1, REQ-2, REQ-6, REQ-7, REQ-15 — scenario "The user reads the session list in English"
test('at 1280 px the list shows "2 need input", "Needs Input", "Running" and "Just now", each inside its element', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await showOnlyOwnSessions(page);
  const asksFirst = await newFolder('asks-first');
  const asksSecond = await newFolder('asks-second');
  const works = await newFolder('works');
  for (const folder of [asksFirst, asksSecond]) {
    await postHook(request, await startViaApi(request, folder), { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  }
  await postHook(request, await startViaApi(request, works), { hook_event_name: 'UserPromptSubmit', prompt: 'run the tests' });

  await page.goto('/');
  const counter = panel(page).getByRole('status').filter({ hasText: /needs? input/ });
  await expect(counter).toHaveText('2 need input');
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(['Needs Input', 'Running']);

  const working = entry(page, works);
  await expect(working.locator('.state-badge')).toHaveText('Running');
  await expect(working.locator('time')).toHaveText('Just now');
  for (const folder of [asksFirst, asksSecond]) {
    const card = entry(page, folder).locator('xpath=ancestor::*[contains(@class, "session-card")][1]');
    await expect(card.locator('.perm-tag')).toHaveText('Needs Input');
    await expect(card.getByRole('button', { name: 'Reply', exact: true })).toBeVisible();
    await expect(card).toContainText('Permission for Bash · Just now');
    await expectFits(card.locator('.perm-tag'), card, `"Needs Input" tag of ${path.basename(folder)}`);
    await expectFits(card.getByRole('button', { name: 'Reply', exact: true }), card, `"Reply" of ${path.basename(folder)}`);
  }

  await expectFits(counter.locator('.needs-input-chip'), panel(page), '"2 need input" pill');
  await expectFits(panel(page).getByRole('heading', { name: 'Sessions', exact: true }), panel(page), '"Sessions" title');
  for (const heading of await panel(page).getByRole('heading', { level: 2 }).all()) await expectFits(heading, panel(page), 'group title');
  await expectFits(working.locator('.state-badge'), working, '"Running" badge');
  await expectFits(working.locator('time'), working, '"Just now" time');
  await expectFits(topBar(page).getByRole('button', { name: 'New Session', exact: true }), topBar(page), 'top bar "New Session"');
  await expectNoItalian(page, 'in the session list');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-6: one session needing input takes the singular
test('one session needing input reads "1 needs input"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const asks = await newFolder('asks-alone');
  await postHook(request, await startViaApi(request, asks), { hook_event_name: 'PermissionRequest', tool_name: 'Edit' });
  await page.goto('/');
  await expect(panel(page).getByRole('status').filter({ hasText: /needs? input/ })).toHaveText('1 needs input');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-1, REQ-2, REQ-3, REQ-4, REQ-9, REQ-14, REQ-15: the open session and its stop confirmation
test('an open working session shows "Interrupt", "Terminate", the English hint and an English stop confirmation', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('billing-api');
  await postHook(request, await startViaApi(request, folder), { hook_event_name: 'UserPromptSubmit', prompt: 'add the invoice export' });
  await page.goto('/');
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);

  const main = page.getByRole('main');
  await expect(main.getByRole('region', { name: 'Terminal: billing-api', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Interrupt', exact: true })).toBeVisible();
  const terminate = main.getByRole('button', { name: 'Terminate', exact: true });
  await expect(terminate).toBeVisible();
  await expect(main.locator('.kbd-badge')).toHaveText(['Ctrl', 'Shift', 'L']);
  await expect(main).toContainText('back to the list');
  await expectNoItalian(page, 'in the open session');

  await terminate.click();
  const confirmation = page.getByRole('alertdialog', { name: 'Terminate the Session?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('billing-api is still working. The current turn will be interrupted. You can resume the conversation from the history.');
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(confirmation.getByRole('button', { name: 'Terminate', exact: true })).toBeVisible();
  await expectNoItalian(page, 'in the stop confirmation');

  await confirmation.getByRole('button', { name: 'Terminate', exact: true }).click();
  await expect(main.getByText('Ended', { exact: true })).toBeVisible();
  await expectNoItalian(page, 'after the session ended');
});
