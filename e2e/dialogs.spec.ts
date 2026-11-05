// e2e of plan-claude_sessions_client-ui_redesign, batch dialogs. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

let projectsRoot: string;
const startedIds: string[] = [];
const terminals: ChildProcess[] = [];

test.beforeAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-dialogs-'));
});

test.afterEach(async ({ request }) => {
  for (const id of startedIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const terminal of terminals.splice(0)) terminal.kill('SIGKILL');
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await rm(projectsRoot, { recursive: true, force: true });
});

const railButton = (page: Page, name: string) => page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name, exact: true });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'Nuova sessione' });
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Cartella del progetto', exact: true });
const history = (page: Page) => page.getByRole('dialog', { name: 'Riprendi sessione' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Sessione in esecuzione in un terminale' });
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminare la sessione?' });
const action = (dialog: Locator, name: string) => dialog.getByRole('button', { name, exact: true });
const pastEntry = (page: Page, folder: string, label: string) =>
  history(page).getByRole('region', { name: folder }).getByRole('radio', { name: label, exact: true });
const listEntry = (page: Page, folder: string) => page.getByRole('region', { name: 'Elenco sessioni' }).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');

const isStartRequest = (url: string, method: string) => new URL(url).pathname === '/api/sessions' && method === 'POST';
const isResumeRequest = (url: string, method: string) => /\/api\/past-sessions\/[^/]+\/resume$/.test(new URL(url).pathname) && method === 'POST';

function record(page: Page, match: (url: string, method: string) => boolean): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (match(r.url(), r.method())) urls.push(r.url());
  });
  return urls;
}

const holdsFocus = (dialog: Locator) => dialog.evaluate((el) => el.contains(document.activeElement));
const paint = (element: Locator) =>
  element.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.backgroundColor} ${s.color} ${s.borderTopColor}`;
  });
/** Size and background of the box that holds the first icon of the dialog. */
const iconLook = (dialog: Locator) =>
  dialog.evaluate((el) => {
    const holder = el.querySelector('svg')?.parentElement;
    if (!holder) return 'no icon';
    const box = holder.getBoundingClientRect();
    return `${Math.round(box.width)}x${Math.round(box.height)} ${getComputedStyle(holder).backgroundColor}`;
  });

/** Primary and cancel action paint, measured with the mouse away from both buttons. */
async function actionPaints(page: Page, dialog: Locator, primary: string): Promise<{ primary: string; cancel: string }> {
  await page.mouse.move(0, 0);
  return { primary: await paint(action(dialog, primary)), cancel: await paint(action(dialog, 'Annulla')) };
}

/** True when an icon sits above the title text, centred on it. */
const iconAboveTitle = (dialog: Locator, title: string) =>
  dialog.evaluate((el, text) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode()) && node.textContent?.trim() !== text);
    if (!node) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    const titleBox = range.getBoundingClientRect();
    return [...el.querySelectorAll('svg')].some((svg) => {
      const box = svg.getBoundingClientRect();
      return box.width > 0 && box.bottom <= titleBox.top + 1 && Math.abs(box.left + box.width / 2 - (titleBox.left + titleBox.width / 2)) <= 1;
    });
  }, title);

async function newFolder(name: string): Promise<string> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  return folder;
}

/** Opens the chooser and waits for its initial listing of the home folder. */
async function openChooser(page: Page): Promise<void> {
  await railButton(page, 'Nuova sessione').click();
  await expect(chooser(page)).toBeVisible();
  await expect(pathField(page)).toHaveValue(os.homedir());
}

/** Writes a session as Claude Code leaves it after a session in the terminal. */
async function pastSession(id: string, folder: string, firstMessage: string, modified: Date): Promise<void> {
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
}

/** Simulates Claude Code running the session in a terminal: a live process with its `sessions/<pid>.json`. */
async function runInTerminal(sessionId: string): Promise<void> {
  const process = spawn('sleep', ['120'], { stdio: 'ignore' });
  terminals.push(process);
  await mkdir(path.join(E2E_CLAUDE_DIR, 'sessions'), { recursive: true });
  await writeFile(path.join(E2E_CLAUDE_DIR, 'sessions', `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId }));
}

async function openHistory(page: Page): Promise<void> {
  await railButton(page, 'Riprendi').click();
  await expect(history(page)).toBeVisible();
  await expect(history(page)).not.toContainText('Caricamento…');
}

async function openWorkingSession(page: Page, request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = await newFolder(name);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  startedIds.push(id);
  await page.goto('/');
  await listEntry(page, folder).click();
  await expect(terminal(page)).toContainText('READY');
  await page.locator('.xterm-screen').click();
  await page.keyboard.type('WORK');
  await page.keyboard.press('Enter');
  await expect(listEntry(page, folder)).toContainText('Lavora');
  return { id, folder };
}

async function lastTick(page: Page): Promise<number> {
  const text = (await terminal(page).textContent()) ?? '';
  return Math.max(0, ...[...text.matchAll(/TICK(\d+)/g)].map((m) => Number(m[1])));
}

test.describe('folder chooser', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-25
  test('has the primary action "Avvia sessione", which looks different from "Annulla", and the path field has the focus', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);

    await expect(chooser(page).getByRole('form', { name: 'Scegli la cartella del progetto' })).toBeVisible();
    await expect(action(chooser(page), 'Annulla')).toBeVisible();
    await expect(action(chooser(page), 'Avvia sessione')).toBeEnabled();
    await expect(pathField(page)).toBeFocused();
    const paints = await actionPaints(page, chooser(page), 'Avvia sessione');
    expect(paints.primary, 'the primary action looks different').not.toBe(paints.cancel);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-25, REQ-26 — scenario "The user starts a session with the keyboard only"
  test('Enter in the path field lists a typed folder, and Enter again starts the session there', async ({ page }) => {
    const folder = await newFolder('keyboard-only');
    await mkdir(path.join(folder, 'sottocartella'));
    const starts = record(page, isStartRequest);
    await page.goto('/');
    await openChooser(page);

    await pathField(page).fill(folder);
    await pathField(page).press('Enter');
    await expect(action(chooser(page), 'sottocartella')).toBeVisible();
    await expect(pathField(page)).toHaveValue(folder);
    await expect(pathField(page)).toBeFocused();
    expect(starts, 'the first Enter only lists the folder').toEqual([]);

    const started = page.waitForResponse((r) => isStartRequest(r.url(), r.request().method()));
    await page.keyboard.press('Enter');
    const response = await started;
    expect(response.status()).toBe(201);
    startedIds.push(((await response.json()) as { id: string }).id);

    await expect(chooser(page)).toBeHidden();
    await expect(terminal(page)).toContainText(`CWD:${folder}`);
    expect(starts).toHaveLength(1);
  });

  // FolderChooser: "Avvia sessione" is disabled while the start request runs, so Enter starts one session only
  test('while the start request runs, "Avvia sessione" is disabled and Enter starts nothing more', async ({ page }) => {
    const folder = await newFolder('held-start');
    const starts = record(page, isStartRequest);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/sessions', async (route) => {
      if (route.request().method() === 'POST') await held;
      await route.continue();
    });
    await page.goto('/');
    await openChooser(page);
    await pathField(page).fill(folder);
    await pathField(page).press('Enter');
    await expect(pathField(page)).toHaveValue(folder);
    await expect(chooser(page).getByRole('alert')).toHaveCount(0);

    await pathField(page).press('Enter');
    await expect.poll(() => starts.length).toBe(1);
    await expect(action(chooser(page), 'Avvia sessione')).toBeDisabled();
    await pathField(page).press('Enter');
    await page.waitForTimeout(300);
    expect(starts).toHaveLength(1);

    const started = page.waitForResponse((r) => isStartRequest(r.url(), r.request().method()));
    release();
    startedIds.push(((await (await started).json()) as { id: string }).id);
    await expect(chooser(page)).toBeHidden();
    await expect(terminal(page)).toContainText(`CWD:${folder}`);
    expect(starts).toHaveLength(1);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-27, Dialog: the focus goes back where it was
  test('Esc closes the chooser with no effect and gives the focus back to "Nuova sessione"', async ({ page }) => {
    const starts = record(page, isStartRequest);
    await page.goto('/');
    await openChooser(page);

    await page.keyboard.press('Escape');

    await expect(chooser(page)).toBeHidden();
    await expect(railButton(page, 'Nuova sessione')).toBeFocused();
    await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
    expect(starts).toEqual([]);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-26: with the focus on another button, Enter acts on that button
  test('Enter with the focus on "Annulla" cancels', async ({ page }) => {
    const starts = record(page, isStartRequest);
    await page.goto('/');
    await openChooser(page);

    await action(chooser(page), 'Annulla').focus();
    await page.keyboard.press('Enter');

    await expect(chooser(page)).toBeHidden();
    await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
    expect(starts).toEqual([]);
  });

  // Dialog: Tab and Shift+Tab stay inside the dialog and wrap
  test('Tab and Shift+Tab keep the focus inside the chooser and wrap around', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);

    await action(chooser(page), 'Avvia sessione').focus();
    await page.keyboard.press('Tab');
    expect(await holdsFocus(chooser(page)), 'Tab from the last action wraps inside').toBe(true);
    await expect(action(chooser(page), 'Avvia sessione')).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(action(chooser(page), 'Avvia sessione')).toBeFocused();

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await holdsFocus(chooser(page)), `Shift+Tab #${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await holdsFocus(chooser(page)), `Tab #${i + 1}`).toBe(true);
    }
  });

  // Dialog: a click on the backdrop does not move the focus out of the dialog
  test('a click on the backdrop leaves the focus in the chooser', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);

    await page.mouse.click(5, 5);

    await expect(chooser(page)).toBeVisible();
    expect(await holdsFocus(chooser(page))).toBe(true);
  });
});

test.describe('resume history', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-25, REQ-26, ResumeDialog: a click, Space or the arrow keys only select an entry
  test('an entry is selected by click, Space or the arrow keys, and Enter outside a button resumes it', async ({ page }) => {
    const folder = await newFolder('history-select');
    await pastSession('e2e-dialogs-a', folder, 'Prima sessione', new Date('2026-10-20T10:00:00Z'));
    await pastSession('e2e-dialogs-b', folder, 'Seconda sessione', new Date('2026-10-21T10:00:00Z'));
    const resumes = record(page, isResumeRequest);
    await page.goto('/');
    await openHistory(page);
    const first = pastEntry(page, folder, 'Prima sessione');
    const second = pastEntry(page, folder, 'Seconda sessione');

    await expect(history(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(action(history(page), 'Riprendi')).toBeDisabled();
    expect(await holdsFocus(history(page)), 'the dialog holds the focus on open').toBe(true);
    await page.keyboard.press('Enter');

    await first.click();
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();
    await expect(action(history(page), 'Riprendi')).toBeEnabled();
    const paints = await actionPaints(page, history(page), 'Riprendi');
    expect(paints.primary, 'the primary action looks different').not.toBe(paints.cancel);

    await second.focus();
    await page.keyboard.press('Space');
    await expect(second).toBeChecked();
    await expect(first).not.toBeChecked();

    const firstIsAbove = (await first.boundingBox())!.y < (await second.boundingBox())!.y;
    await page.keyboard.press(firstIsAbove ? 'ArrowUp' : 'ArrowDown');
    await expect(first).toBeChecked();
    await expect(second).not.toBeChecked();
    await page.waitForTimeout(500);
    await expect(history(page)).toBeVisible();
    expect(resumes, 'selecting an entry sends no request').toEqual([]);

    await expect(first).toBeFocused();
    const resumed = page.waitForResponse((r) => isResumeRequest(r.url(), r.request().method()));
    await page.keyboard.press('Enter');
    const response = await resumed;
    expect(response.status()).toBe(201);
    startedIds.push(((await response.json()) as { id: string }).id);

    await expect(history(page)).toBeHidden();
    await expect(terminal(page)).toContainText('"--resume","e2e-dialogs-a"');
    expect(resumes).toHaveLength(1);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-27
  test('Esc closes the resume history with no effect', async ({ page }) => {
    const folder = await newFolder('history-esc');
    await pastSession('e2e-dialogs-esc', folder, 'Sessione da non riprendere', new Date('2026-10-22T10:00:00Z'));
    const resumes = record(page, isResumeRequest);
    await page.goto('/');
    await openHistory(page);
    await pastEntry(page, folder, 'Sessione da non riprendere').click();

    await page.keyboard.press('Escape');

    await expect(history(page)).toBeHidden();
    await expect(railButton(page, 'Riprendi')).toBeFocused();
    await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
    expect(resumes).toEqual([]);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-25, REQ-26, REQ-27, REQ-28 — scenario "The user closes the warning with Esc"
  test('the running-elsewhere warning opens on top, looks different, and Esc or Enter closes only the warning', async ({ page }) => {
    const folder = await newFolder('history-warning');
    await pastSession('e2e-dialogs-running', folder, 'Sessione nel terminale', new Date('2026-10-23T10:00:00Z'));
    await runInTerminal('e2e-dialogs-running');
    const resumes = record(page, isResumeRequest);
    await page.goto('/');
    await openHistory(page);
    await pastEntry(page, folder, 'Sessione nel terminale').click();
    const historyLook = { icon: await iconLook(history(page)), ...(await actionPaints(page, history(page), 'Riprendi')) };

    await action(history(page), 'Riprendi').click();

    await expect(warning(page)).toBeVisible();
    await expect(action(warning(page), 'Annulla')).toBeFocused();
    await expect(action(warning(page), 'Riprendi comunque')).toBeVisible();
    const box = await warning(page).boundingBox();
    expect(box).not.toBeNull();
    const onTop = await warning(page).evaluate(
      (el, point) => el.contains(document.elementFromPoint(point.x, point.y)),
      { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 },
    );
    expect(onTop, 'the warning is above the resume history').toBe(true);
    const warningPaints = await actionPaints(page, warning(page), 'Riprendi comunque');
    expect(warningPaints.primary, 'the primary action looks different from "Annulla"').not.toBe(warningPaints.cancel);
    expect(warningPaints.primary, 'the primary action looks different from a normal dialog').not.toBe(historyLook.primary);
    expect(await iconLook(warning(page)), 'the warning icon sits in a coloured circle').not.toBe(historyLook.icon);
    expect(await iconAboveTitle(warning(page), 'Sessione in esecuzione in un terminale'), 'a warning icon above the title').toBe(true);

    await page.keyboard.press('Escape');

    await expect(warning(page)).toBeHidden();
    await expect(history(page)).toBeVisible();
    expect(await holdsFocus(history(page)), 'the focus goes back to the resume history').toBe(true);
    await page.waitForTimeout(300);
    expect(resumes, 'Esc resumes nothing').toEqual([]);

    await action(history(page), 'Riprendi').click();
    await expect(action(warning(page), 'Annulla')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(warning(page)).toBeHidden();
    await expect(history(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect(resumes, 'Enter on "Annulla" resumes nothing').toEqual([]);
    await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
  });
});

test.describe('stop confirmation', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-25, REQ-26, REQ-28 — scenario "The user sees that stopping a working session is risky"
  test('looks different from the folder chooser, has the focus on "Annulla", and Enter keeps the session working', async ({ page, request }) => {
    const { id, folder } = await openWorkingSession(page, request, 'stop-enter');
    const stops = record(page, (url, method) => new URL(url).pathname === `/api/sessions/${id}/stop` && method === 'POST');
    await openChooser(page);
    const chooserLook = { icon: await iconLook(chooser(page)), ...(await actionPaints(page, chooser(page), 'Avvia sessione')) };
    await page.keyboard.press('Escape');
    await expect(chooser(page)).toBeHidden();

    await page.getByRole('button', { name: 'Termina', exact: true }).first().click();

    await expect(confirmation(page)).toBeVisible();
    await expect(confirmation(page)).toContainText(
      'stop-enter sta ancora lavorando. Il turno in corso verrà interrotto; potrai riprendere la conversazione dalla cronologia.',
    );
    await expect(action(confirmation(page), 'Annulla')).toBeFocused();
    const paints = await actionPaints(page, confirmation(page), 'Termina');
    expect(paints.primary, 'the primary action looks different from "Annulla"').not.toBe(paints.cancel);
    expect(paints.primary, 'the primary action looks different from the folder chooser one').not.toBe(chooserLook.primary);
    expect(await iconLook(confirmation(page)), 'the icon sits in a coloured circle, unlike the folder chooser').not.toBe(chooserLook.icon);
    expect(await iconAboveTitle(confirmation(page), 'Terminare la sessione?'), 'a warning icon above the title').toBe(true);

    await page.keyboard.press('Enter');

    await expect(confirmation(page)).toBeHidden();
    const tick = await lastTick(page);
    await expect.poll(() => lastTick(page)).toBeGreaterThan(tick + 2);
    await expect(listEntry(page, folder)).toContainText('Lavora');
    expect(stops).toEqual([]);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-27
  test('Esc closes the confirmation with no stop request', async ({ page, request }) => {
    const { id, folder } = await openWorkingSession(page, request, 'stop-esc');
    const stops = record(page, (url, method) => new URL(url).pathname === `/api/sessions/${id}/stop` && method === 'POST');
    await page.getByRole('button', { name: 'Termina', exact: true }).first().click();
    await expect(confirmation(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(confirmation(page)).toBeHidden();
    await page.waitForTimeout(500);
    await expect(listEntry(page, folder)).toContainText('Lavora');
    expect(stops).toEqual([]);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-26: once the focus moves to "Termina", Enter stops the session
  test('Tab to "Termina" and Enter stop the session', async ({ page, request }) => {
    const { id, folder } = await openWorkingSession(page, request, 'stop-tab-enter');
    const stops = record(page, (url, method) => new URL(url).pathname === `/api/sessions/${id}/stop` && method === 'POST');
    await page.getByRole('button', { name: 'Termina', exact: true }).first().click();
    await expect(action(confirmation(page), 'Annulla')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(action(confirmation(page), 'Termina')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(confirmation(page)).toBeHidden();
    await expect(listEntry(page, folder)).toContainText('Terminata');
    expect(stops).toHaveLength(1);
  });
});
