// e2e of plan-keyboard_shortcuts, batch navigation: the navigation shortcuts on hosted sessions.
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

const ONE_SECOND = { timeout: 1000 };

let projectsRoot: string;
const createdIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
});

// The page shows only the sessions of the running test: other specs and the earlier tests of this file leave theirs on the server.
test.beforeEach(async ({ page }) => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-nav-keys-'));
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
});

const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const terminalInput = (page: Page) => page.locator('.xterm-helper-textarea');
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'No session needs input' });

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

/** Starts one idle session per name and loads the page; gives the folders in list order, top to bottom. */
async function sessionsInList(page: Page, request: APIRequestContext, names: string[]): Promise<{ folders: string[]; ids: Map<string, string> }> {
  const ids = new Map<string, string>();
  for (const name of names) {
    const folder = await newFolder(name);
    ids.set(folder, await startViaApi(request, folder));
  }
  await page.goto('/');
  for (const folder of ids.keys()) await expect(entry(page, folder)).toBeVisible();
  return { folders: await listOrder(page), ids };
}

async function listOrder(page: Page): Promise<string[]> {
  const titles = await list(page)
    .locator(`[title^="${projectsRoot}${path.sep}"]`)
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('title') ?? ''));
  return [...new Set(titles)];
}

async function openByClick(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(terminal(page)).toContainText('READY');
}

async function focusTerminal(page: Page): Promise<void> {
  await page.locator('.xterm-screen').click();
  await expect(terminalInput(page)).toBeFocused();
}

async function expectOpen(page: Page, folder: string): Promise<void> {
  await expect(terminal(page)).toContainText(`CWD:${folder}`, ONE_SECOND);
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true', ONE_SECOND);
}

async function showsRing(page: Page, target: Locator): Promise<boolean> {
  const ring = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-focus-ring)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  return target.evaluate((el, ringColour) => {
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === ringColour;
    return outline || s.boxShadow.includes(ringColour);
  }, ring);
}

const at = (folders: string[], index: number) => folders[index] ?? '';

// plan-keyboard_shortcuts/REQ-5, REQ-10, REQ-11, REQ-39, REQ-40 — scenario "The user opens the next session from the terminal"
test('Alt+Down in the terminal opens the next session as a click does, and types nothing in the CLI', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['next-a', 'next-b', 'next-c']);
  await openByClick(page, at(folders, 1));
  await focusTerminal(page);

  await page.keyboard.press('Alt+ArrowDown');
  await expectOpen(page, at(folders, 2));
  await expect(entry(page, at(folders, 1))).not.toHaveAttribute('aria-current', 'true');
  await expect(terminalInput(page)).toBeFocused();

  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(300);
  await expectOpen(page, at(folders, 2));
  await expect(terminal(page), 'Alt+Down on the last entry reaches the CLI').not.toContainText('IN:');

  await openByClick(page, at(folders, 1));
  await expect(terminal(page), 'Alt+Down reached the CLI of the session it left').not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-4, REQ-6, REQ-43 — scenario "The user jumps to a session by its position"
test('Alt+1 to Alt+9 open the session at that position, and Alt+Up stops at the top', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['pos-a', 'pos-b', 'pos-c']);
  await openByClick(page, at(folders, 2));

  await page.keyboard.press('Alt+Digit1');
  await expectOpen(page, at(folders, 0));

  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(300);
  await expectOpen(page, at(folders, 0));

  await page.keyboard.press('Alt+Digit3');
  await expectOpen(page, at(folders, 2));
  await page.keyboard.press('Alt+ArrowUp');
  await expectOpen(page, at(folders, 1));

  await page.keyboard.press('Alt+Digit9');
  await page.waitForTimeout(300);
  await expectOpen(page, at(folders, 1));
});

// plan-keyboard_shortcuts/REQ-4, REQ-5, assumption "Previous and next": with no open session, next opens the first entry and previous the last
test('with no open session, Alt+Down opens the first entry and Alt+Up the last', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['none-a', 'none-b', 'none-c']);
  await expect(page.getByText('No open session.')).toBeVisible();

  await page.keyboard.press('Alt+ArrowDown');
  await expectOpen(page, at(folders, 0));

  await page.reload();
  await expect(page.getByText('No open session.')).toBeVisible();
  await expect(entry(page, at(folders, 2))).toBeVisible();
  await page.keyboard.press('Alt+ArrowUp');
  await expectOpen(page, at(folders, 2));
});

// plan-keyboard_shortcuts/REQ-1, REQ-3, REQ-39 — scenario "The user moves the focus between the list and the session"
test('Alt+L moves the focus to the open entry, and Alt+C puts it back in the terminal', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['focus-a', 'focus-b']);
  const open = at(folders, 1);
  await openByClick(page, open);
  await focusTerminal(page);

  await page.keyboard.press('Alt+KeyL');
  await expect(entry(page, open)).toBeFocused();
  await expect.poll(() => showsRing(page, entry(page, open))).toBe(true);

  await page.keyboard.press('Alt+KeyC');
  await expect(terminalInput(page)).toBeFocused();
  await page.keyboard.type('ping');
  await page.keyboard.press('Enter');
  await expect(terminal(page)).toContainText('LINE:ping');
  await expect(terminal(page), 'Alt+L or Alt+C reached the CLI').not.toContainText('IN:1b');
});

// plan-keyboard_shortcuts/REQ-3, REQ-43: Alt+C with no open session does nothing
test('Alt+C with no open session leaves the focus where it is', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['nothing-open']);
  await expect(page.getByText('No open session.')).toBeVisible();
  await page.keyboard.press('Alt+KeyL');
  await expect(entry(page, at(folders, 0))).toBeFocused();

  await page.keyboard.press('Alt+KeyC');
  await expect(entry(page, at(folders, 0))).toBeFocused();
  await expect(page.getByText('No open session.')).toBeVisible();
});

// plan-keyboard_shortcuts/REQ-2, REQ-44 — scenario "The existing key still leaves the terminal"
test('Ctrl+Shift+L in the terminal still moves the focus to the open entry', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['ctrl-a', 'ctrl-b']);
  const open = at(folders, 0);
  await openByClick(page, open);
  await focusTerminal(page);

  await page.keyboard.press('Control+Shift+KeyL');
  await expect(entry(page, open)).toBeFocused();
  await expect.poll(() => showsRing(page, entry(page, open))).toBe(true);
  await expect(terminal(page)).not.toContainText('IN:');
});

// plan-keyboard_shortcuts/REQ-7, REQ-8 — scenario "The user goes through the sessions that need input"
test('Alt+I opens the next session that needs input, then wraps to the top of the list', async ({ page, request }) => {
  const ids = new Map<string, string>();
  for (const name of ['ask-a', 'ask-b', 'ask-c', 'calm']) {
    const folder = await newFolder(name);
    ids.set(folder, await startViaApi(request, folder));
  }
  for (const name of ['ask-a', 'ask-b', 'ask-c']) {
    await postHook(request, ids.get(path.join(projectsRoot, name)) ?? '', { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  }
  await page.goto('/');
  for (const name of ['ask-a', 'ask-b', 'ask-c']) await expect(entry(page, path.join(projectsRoot, name))).toContainText('Needs Input');
  await expect(entry(page, path.join(projectsRoot, 'calm'))).toContainText('Idle');
  const folders = await listOrder(page);
  expect(at(folders, 3), 'the session that does not need input is last').toBe(path.join(projectsRoot, 'calm'));

  await openByClick(page, at(folders, 1));
  await page.keyboard.press('Alt+KeyI');
  await expectOpen(page, at(folders, 2));

  await page.keyboard.press('Alt+KeyI');
  await expectOpen(page, at(folders, 0));

  await page.keyboard.press('Alt+KeyI');
  await expectOpen(page, at(folders, 1));
  await expect(toast(page)).toHaveCount(0);
});

// plan-keyboard_shortcuts/REQ-9, REQ-43 — scenario "No session needs input"
test('Alt+I with no session that needs input keeps the open session and shows a short message for a few seconds', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { folders } = await sessionsInList(page, request, ['idle-a', 'idle-b']);
  await openByClick(page, at(folders, 0));
  await focusTerminal(page);

  await page.keyboard.press('Alt+KeyI');
  await expect(toast(page)).toHaveText('No session needs input', ONE_SECOND);
  await expectOpen(page, at(folders, 0));
  await expect(terminal(page)).not.toContainText('IN:');

  const box = await toast(page).boundingBox();
  expect(box, 'the message is rendered').not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - 640), 'the message is centred').toBeLessThanOrEqual(2);
  expect(Math.abs(800 - (box!.y + box!.height) - 20), 'the message is 20 px from the bottom').toBeLessThanOrEqual(2);

  await page.waitForTimeout(2500);
  await expect(toast(page), 'the message still shows after 2.5 s').toBeVisible();
  await expect(toast(page), 'the message goes away by itself').toHaveCount(0, { timeout: 3000 });
});

// ShortMessageToast contract: a new text restarts the 4 s
test('Alt+I pressed again while the message shows keeps it for 4 s more', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['again-a']);
  await openByClick(page, at(folders, 0));

  await page.keyboard.press('Alt+KeyI');
  await expect(toast(page)).toBeVisible(ONE_SECOND);
  await page.waitForTimeout(3000);
  await page.keyboard.press('Alt+KeyI');
  await page.waitForTimeout(2500);
  await expect(toast(page), 'the message still shows 5.5 s after the first key').toBeVisible();
  await expect(toast(page)).toHaveCount(0, { timeout: 3000 });
});

// plan-keyboard_shortcuts/REQ-42: while a dialog is open, the shortcuts do nothing and the dialog keeps its keys
test('while the folder chooser is open, Alt+Down and Alt+1 open nothing', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['dialog-a', 'dialog-b']);
  await openByClick(page, at(folders, 1));
  await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'New Claude Code Session' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  for (const key of ['Alt+ArrowUp', 'Alt+Digit1', 'Alt+KeyI']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  await expect(toast(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expectOpen(page, at(folders, 1));
});

// plan-keyboard_shortcuts/REQ-41: in a text field the editing keys keep working, and a map key still acts
test('in the terminal search box the editing keys work, and Alt+Down still opens the next session', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['field-a', 'field-b']);
  await openByClick(page, at(folders, 0));
  await focusTerminal(page);
  await page.keyboard.press('Control+Shift+KeyF');
  const field = page.getByRole('textbox', { name: 'Search in terminal' });
  await expect(field).toBeFocused();

  await page.keyboard.type('abcd');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Home');
  await page.keyboard.type('x');
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('Delete');
  await page.keyboard.type('y');
  await expect(field).toHaveValue('xy');

  await page.keyboard.press('Alt+ArrowDown');
  await expectOpen(page, at(folders, 1));
});

// useShortcutKeys contract, plan-keyboard_shortcuts/REQ-46: a map key runs in the same event, is cancelled and never reaches the element
test('a map key acts in the same event, is cancelled and stopped; any other key passes untouched', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['event-a']);
  await expect(entry(page, at(folders, 0))).toBeVisible();

  const outcome = await page.evaluate((title) => {
    const send = (code: string, init: KeyboardEventInit) => {
      let reached = false;
      const mark = () => (reached = true);
      document.body.addEventListener('keydown', mark);
      const passed = document.body.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init }));
      document.body.removeEventListener('keydown', mark);
      const focusedTitle = Boolean(document.activeElement?.querySelector(`[title="${CSS.escape(title)}"]`));
      return { passed, reached, focusedTitle };
    };
    return {
      mapKey: send('KeyL', { key: 'l', altKey: true }),
      otherKey: send('KeyZ', { key: 'z', altKey: true }),
    };
  }, at(folders, 0));

  expect(outcome.mapKey, 'Alt+L').toEqual({ passed: false, reached: false, focusedTitle: true });
  expect(outcome.otherKey.passed, 'Alt+Z is not cancelled').toBe(true);
  expect(outcome.otherKey.reached, 'Alt+Z reaches the element').toBe(true);
});

// plan-keyboard_shortcuts/REQ-45: a key typed with AltGr is never a shortcut
test('Alt+L with AltGr pressed runs nothing and passes untouched', async ({ page, request }) => {
  const { folders } = await sessionsInList(page, request, ['altgr-a']);
  await openByClick(page, at(folders, 0));
  await focusTerminal(page);

  const outcome = await page.evaluate(() => {
    let reached = false;
    const mark = () => (reached = true);
    document.body.addEventListener('keydown', mark);
    const event = new KeyboardEvent('keydown', { code: 'KeyL', key: 'ł', altKey: true, modifierAltGraph: true, bubbles: true, cancelable: true } as KeyboardEventInit);
    const passed = document.body.dispatchEvent(event);
    document.body.removeEventListener('keydown', mark);
    return { altGraph: event.getModifierState('AltGraph'), passed, reached };
  });

  expect(outcome.altGraph, 'the browser builds an AltGr event').toBe(true);
  expect(outcome.passed, 'not cancelled').toBe(true);
  expect(outcome.reached, 'reaches the element').toBe(true);
  await expect(terminalInput(page)).toBeFocused();
});
