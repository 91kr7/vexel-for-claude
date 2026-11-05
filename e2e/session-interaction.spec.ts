// e2e of plan-claude_sessions_client, batch session-interaction. The server runs the fake CLI (playwright.config.ts).
import { chmod, mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Page, expect, test } from '@playwright/test';

let projectsRoot: string;
let projectA: string;
let projectB: string;
let locked: string;

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-'));
  projectA = path.join(projectsRoot, 'project-a');
  projectB = path.join(projectsRoot, 'project-b');
  locked = path.join(projectsRoot, 'locked');
  for (const dir of [projectA, projectB, locked]) await mkdir(dir);
  await chmod(locked, 0o000);
});

test.afterAll(async () => {
  await chmod(locked, 0o755);
});

const chooser = (page: Page) => page.getByRole('form', { name: 'Scegli la cartella del progetto' });
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Cartella del progetto', exact: true });
const terminal = (page: Page) => page.locator('.xterm-rows');
const focusTerminal = (page: Page) => page.locator('.xterm-screen').click();

/** Opens the chooser and waits for its initial listing of the home folder. */
async function openChooser(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nuova sessione' }).click();
  await expect(pathField(page)).toHaveValue(os.homedir());
}

async function startSession(page: Page, folder: string): Promise<void> {
  await openChooser(page);
  await pathField(page).fill(folder);
  await page.getByRole('button', { name: 'Avvia sessione' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
}

async function typeLine(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the page is in Italian and shows no open session', async ({ page }) => {
  await expect(page).toHaveTitle('Sessioni Claude');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('heading', { name: 'Sessioni Claude' })).toBeVisible();
  await expect(page.getByText('Nessuna sessione aperta.')).toBeVisible();
});

test('the folder chooser opens on the home folder', async ({ page }) => {
  await openChooser(page);
  await expect(chooser(page)).toBeVisible();
  await expect(chooser(page).getByRole('button', { name: '..', exact: true })).toBeVisible();
});

test('the user browses to a project folder and starts a session in it', async ({ page }) => {
  await openChooser(page);
  await pathField(page).fill(projectsRoot);
  await pathField(page).press('Enter');
  await chooser(page).getByRole('button', { name: 'project-a', exact: true }).click();
  await expect(pathField(page)).toHaveValue(projectA);
  await chooser(page).getByRole('button', { name: '..', exact: true }).click();
  await expect(pathField(page)).toHaveValue(projectsRoot);
  await expect(chooser(page).getByRole('button', { name: 'project-b', exact: true })).toBeVisible();
  await chooser(page).getByRole('button', { name: 'project-a', exact: true }).click();
  await page.getByRole('button', { name: 'Avvia sessione' }).click();

  await expect(chooser(page)).toBeHidden();
  await expect(page.getByText('Nessuna sessione aperta.')).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${projectA}`);
  await expect(terminal(page)).toContainText('ARGS:[]');
});

test('the user sends a message, a slash command and Esc from the keyboard', async ({ page }) => {
  await startSession(page, projectA);
  await focusTerminal(page);
  await typeLine(page, 'ciao');
  await expect(terminal(page)).toContainText('LINE:ciao');
  await typeLine(page, '/help');
  await expect(terminal(page)).toContainText('LINE:/help');
  await page.keyboard.press('Escape');
  await expect(terminal(page)).toContainText('IN:1b');
});

test('"Interrompi" sends Esc and gives focus back to the terminal', async ({ page }) => {
  await startSession(page, projectA);
  await page.getByRole('button', { name: 'Interrompi' }).click();
  await expect(terminal(page)).toContainText('IN:1b');
  await page.keyboard.type('z');
  await expect(terminal(page)).toContainText('IN:7a');
});

test('the response appears while the CLI produces it', async ({ page }) => {
  await startSession(page, projectA);
  await focusTerminal(page);
  await typeLine(page, 'STREAM');
  await expect(terminal(page)).toContainText('CHUNK1');
  await expect(terminal(page)).not.toContainText('CHUNK5');
  await expect(terminal(page)).toContainText('CHUNK5');
});

test('a permission request waits until the user answers it', async ({ page }) => {
  await startSession(page, projectA);
  await focusTerminal(page);
  await typeLine(page, 'ASK');
  await expect(terminal(page)).toContainText('PERMISSION?(y/n)');
  await page.waitForTimeout(1500);
  await expect(terminal(page)).not.toContainText('ANSWER:');
  await page.keyboard.type('y');
  await expect(terminal(page)).toContainText('ANSWER:y');
});

test('the terminal follows the size of its container', async ({ page }) => {
  await startSession(page, projectA);
  const lastSize = async () => {
    const text = (await terminal(page).textContent()) ?? '';
    const last = [...text.matchAll(/(?:SIZE|WINCH):(\d+)x(\d+)/g)].at(-1);
    return { cols: Number(last?.[1]), rows: Number(last?.[2]) };
  };
  const before = await lastSize();
  await page.setViewportSize({ width: 700, height: 400 });
  await expect.poll(async () => (await lastSize()).cols).toBeLessThan(before.cols);
  expect((await lastSize()).rows).toBeLessThan(before.rows);
});

test('the terminal shows the disconnection when the session ends', async ({ page }) => {
  await startSession(page, projectA);
  await focusTerminal(page);
  await typeLine(page, '/exit');
  await expect(terminal(page)).toContainText('[Sessione disconnessa]');
});

test('a new session becomes the open one; "Annulla" keeps the open session', async ({ page }) => {
  await startSession(page, projectA);
  await page.getByRole('button', { name: 'Nuova sessione' }).click();
  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${projectA}`);

  await startSession(page, projectB);
  await expect(terminal(page)).not.toContainText(`CWD:${projectA}`);
});

test('a path typed right after the chooser opens is the folder of the session', async ({ page }) => {
  await page.getByRole('button', { name: 'Nuova sessione' }).click();
  await pathField(page).fill(projectB);
  await page.getByRole('button', { name: 'Avvia sessione' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${projectB}`);
});

test('a home listing that ends after the user typed does not replace the typed path', async ({ page }) => {
  let releaseHome: () => void = () => {};
  const homeHeld = new Promise<void>((resolve) => (releaseHome = resolve));
  let homeRequested = false;
  await page.route(
    (url) => url.pathname === '/api/folders' && !url.searchParams.has('path'),
    async (route) => {
      homeRequested = true;
      await homeHeld;
      await route.continue();
    },
  );
  await page.getByRole('button', { name: 'Nuova sessione' }).click();
  await expect.poll(() => homeRequested).toBe(true);
  await pathField(page).fill(projectB);
  const homeListed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/folders' && !new URL(response.url()).searchParams.has('path'),
  );
  releaseHome();
  await homeListed;
  await expect(pathField(page)).toHaveValue(projectB);
  await page.getByRole('button', { name: 'Avvia sessione' }).click();
  await expect(chooser(page)).toBeHidden();
  await expect(terminal(page)).toContainText(`CWD:${projectB}`);
});

test.describe('folder chooser errors', () => {
  test.beforeEach(async ({ page }) => {
    await openChooser(page);
  });

  async function expectErrorAndNoSession(page: Page, message: string): Promise<void> {
    await expect(chooser(page).getByRole('alert')).toHaveText(message);
    await expect(chooser(page)).toBeVisible();
    await expect(page.getByText('Nessuna sessione aperta.')).toBeAttached();
    await expect(terminal(page)).toHaveCount(0);
  }

  test('starting in a folder that does not exist', async ({ page }) => {
    await pathField(page).fill(path.join(projectsRoot, 'missing'));
    await page.getByRole('button', { name: 'Avvia sessione' }).click();
    await expectErrorAndNoSession(page, 'La cartella non esiste.');
  });

  test('starting with a relative path', async ({ page }) => {
    await pathField(page).fill('relative/dir');
    await page.getByRole('button', { name: 'Avvia sessione' }).click();
    await expectErrorAndNoSession(page, 'Inserisci un percorso assoluto.');
  });

  test('browsing a folder that does not exist', async ({ page }) => {
    await pathField(page).fill(path.join(projectsRoot, 'missing'));
    await pathField(page).press('Enter');
    await expectErrorAndNoSession(page, 'La cartella non esiste.');
  });

  test('browsing a folder that cannot be read', async ({ page }) => {
    test.skip(process.getuid?.() === 0, 'root reads every folder');
    await pathField(page).fill(locked);
    await pathField(page).press('Enter');
    await expectErrorAndNoSession(page, 'La cartella non è leggibile.');
  });

  test('any other failure', async ({ page }) => {
    await page.route('**/api/sessions', (route) => route.abort());
    await pathField(page).fill(projectA);
    await page.getByRole('button', { name: 'Avvia sessione' }).click();
    await expectErrorAndNoSession(page, 'Operazione non riuscita.');
  });
});
