// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch dialogs: the four dialogs as board "Dialoghi".
// The server reads the fixture Claude Code folder E2E_CLAUDE_DIR: the file name matches `claudeDirSpecs` in playwright.config.ts.
/// <reference lib="dom" />
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Box = { x: number; y: number; width: number; height: number };
type Rgba = [number, number, number, number];

// Rounding of fractional layout sizes.
const TOLERANCE = 1;
// Rounding of blended pixel colours.
const COLOUR_TOLERANCE = 2;
// The board leaves Chromium's default radio margin (3px 3px 0 5px): measured on proposta-dialoghi.html at 1440 x 900.
const RADIO_MARGIN = { top: 3, right: 3 };
const BOARD_SHADOW = 'rgba(0, 0, 0, 0.25) 0px 8px 24px 0px';
const STOP_TEXT = 'sta ancora lavorando. Il turno in corso verrà interrotto; potrai riprendere la conversazione dalla cronologia.';

let projectsRoot: string;
const startedIds: string[] = [];
const terminals: ChildProcess[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  // A short root keeps the sample paths on one line, as the board draws them.
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'bd-'));
});

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
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
const recents = (page: Page) => chooser(page).getByRole('radiogroup', { name: 'Progetti recenti' });
const recent = (page: Page, name: string) => recents(page).getByRole('radio', { name, exact: true });
/** A row of a radio group: a direct child of the group that holds the radio. */
const rowOf = (group: Locator, name: string) => group.locator(':scope > *').filter({ has: group.page().getByRole('radio', { name, exact: true }) });
const history = (page: Page) => page.getByRole('dialog', { name: 'Riprendi sessione' });
const pastSessions = (page: Page) => history(page).getByRole('radiogroup', { name: 'Sessioni passate' });
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminare la sessione?' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Sessione in esecuzione in un terminale' });
const action = (dialog: Locator, name: string) => dialog.getByRole('button', { name, exact: true });
const loading = (scope: Locator) => scope.getByRole('status').filter({ hasText: 'Caricamento…' });
const listEntry = (page: Page, folder: string) => page.getByRole('region', { name: 'Elenco sessioni' }).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');
const firstIcon = (scope: Locator) => scope.locator('svg').first();

const isPastSessionsRequest = (url: string, method: string) => new URL(url).pathname === '/api/past-sessions' && method === 'GET';
const isStartRequest = (url: string, method: string) => new URL(url).pathname === '/api/sessions' && method === 'POST';

function record(page: Page, match: (url: string, method: string) => boolean): string[] {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (match(r.url(), r.method())) urls.push(r.url());
  });
  return urls;
}

/** A new folder `<name>` in its own directory, so that tests can reuse the board folder names. */
async function newFolder(name: string): Promise<string> {
  const folder = path.join(await mkdtemp(projectsRoot + path.sep), name);
  await mkdir(folder);
  return folder;
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

/** The "Recenti" sample of the board: "billing-api" (latest, two sessions), then "infra-terraform", then "docs-site". */
async function boardRecents(): Promise<{ billing: string; infra: string; docs: string }> {
  const billing = await newFolder('billing-api');
  const infra = await newFolder('infra-terraform');
  const docs = await newFolder('docs-site');
  await pastSession('board-billing-old', billing, 'Sessione più vecchia', new Date('2026-10-01T10:00:00Z'));
  await pastSession('board-docs', docs, 'Aggiorna la guida', new Date('2026-11-01T10:00:00Z'));
  await pastSession('board-infra', infra, 'Aggiungi il modulo VPC', new Date('2026-11-02T10:00:00Z'));
  await pastSession('board-billing', billing, "Aggiungi la validazione dell'IBAN", new Date('2026-11-03T10:00:00Z'));
  return { billing, infra, docs };
}

async function openChooser(page: Page): Promise<void> {
  await railButton(page, 'Nuova sessione').click();
  await expect(chooser(page)).toBeVisible();
  await expect(pathField(page)).toHaveValue(os.homedir());
  await expect(loading(chooser(page))).toHaveCount(0);
}

async function openHistory(page: Page): Promise<void> {
  await railButton(page, 'Riprendi').click();
  await expect(history(page)).toBeVisible();
  await expect(loading(history(page))).toHaveCount(0);
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

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

const bottom = (b: Box) => b.y + b.height;
const right = (b: Box) => b.x + b.width;
const centreX = (b: Box) => b.x + b.width / 2;
const centreY = (b: Box) => b.y + b.height / 2;
const near = (actual: number, expected: number, what: string) => expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(TOLERANCE);

async function styles(target: Locator, properties: string[]): Promise<Record<string, string>> {
  return target.evaluate((el, list) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(list.map((p) => [p, s.getPropertyValue(p)]));
  }, properties);
}

async function expectStyles(target: Locator, expected: Record<string, string>, what: string): Promise<void> {
  expect(await styles(target, Object.keys(expected)), what).toEqual(expected);
}

/** The computed colour of a CSS value, e.g. `var(--primary)`, in the theme of the page. */
function colour(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  }, cssValue);
}

const role = (page: Page, token: string) => colour(page, `var(${token})`);

/** Any CSS colour as 0–255 channels, alpha included, over nothing. */
function channels(page: Page, css: string): Promise<Rgba> {
  return page.evaluate((value) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = ctx.canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data] as Rgba;
  }, css);
}

/** The colour on screen at one point of the viewport. */
async function pixel(page: Page, x: number, y: number): Promise<Rgba> {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    ctx.canvas.width = ctx.canvas.height = 1;
    ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data] as Rgba;
  }, png.toString('base64'));
}

const closeTo = (actual: Rgba, expected: number[]) => expected.every((c, i) => Math.abs(c - actual[i]!) <= COLOUR_TOLERANCE);
const blend = (under: Rgba, over: Rgba, alpha: number) => [0, 1, 2].map((i) => Math.round(under[i]! * (1 - alpha) + over[i]! * alpha));

/** The colour of a text as the eye sees it: its colour and the opacity of the element, alpha multiplied. */
async function textPaint(page: Page, target: Locator): Promise<{ rgb: number[]; alpha: number }> {
  const { color, opacity } = await target.evaluate((el) => ({ color: getComputedStyle(el).color, opacity: Number(getComputedStyle(el).opacity) }));
  const [r, g, b, a] = await channels(page, color);
  return { rgb: [r, g, b], alpha: Math.round((a / 255) * opacity * 100) / 100 };
}

async function expectFont(target: Locator, family: 'Roboto Flex' | 'Roboto Mono', type: Record<string, string>, what: string): Promise<void> {
  const s = await styles(target, ['font-family', ...Object.keys(type)]);
  expect(s['font-family'], `${what}: font family`).toMatch(new RegExp(`^"?${family}"?,`));
  delete s['font-family'];
  expect(s, `${what}: type`).toEqual(type);
}

const HEADLINE_S = { 'font-size': '24px', 'line-height': '32px', 'font-weight': '400' };
const BODY_M = { 'font-size': '14px', 'line-height': '20px', 'letter-spacing': '0.25px' };
const BODY_L = { 'font-size': '16px', 'line-height': '24px', 'letter-spacing': '0.5px' };
const LABEL_L = { 'font-size': '14px', 'line-height': '20px', 'font-weight': '500', 'letter-spacing': '0.1px' };
const LABEL_M = { 'font-size': '12px', 'line-height': '16px', 'font-weight': '500', 'letter-spacing': '0.5px' };
const MONO_S = { 'font-size': '12px', 'line-height': '16px' };

/** The board frame: width, centring in the 1440 x 900 viewport, radius, padding, background and shadow. */
async function expectBoardFrame(page: Page, frame: Locator, width: number, what: string): Promise<Box> {
  const b = await box(frame);
  near(b.width, width, `${what} width`);
  near(centreX(b), 720, `${what} horizontal centre`);
  near(b.y, 900 - bottom(b), `${what} vertical centring (space above vs below)`);
  await expectStyles(
    frame,
    {
      'border-top-left-radius': '28px',
      'border-bottom-right-radius': '28px',
      'padding-top': '24px',
      'padding-right': '24px',
      'padding-bottom': '24px',
      'padding-left': '24px',
      'background-color': await role(page, '--dialog'),
      'box-shadow': BOARD_SHADOW,
    },
    `${what} frame`,
  );
  expect((await styles(frame, ['font-family']))['font-family'], `${what} font`).toMatch(/^"?Roboto Flex"?,/);
  return b;
}

/** A centred title in `.headline-s`, 16 px under the icon above it; returns its box. */
async function expectTitle(page: Page, title: Locator, above: Box, what: string): Promise<Box> {
  const b = await box(title);
  near(b.y, bottom(above) + 16, `${what} title 16 below the icon`);
  await expectFont(title, 'Roboto Flex', HEADLINE_S, `${what} title`);
  await expectStyles(title, { 'text-align': 'center', color: await role(page, '--on-surface') }, `${what} title`);
  return b;
}

/** The text action buttons of the board: 40 high, padding 0 24, radius 20, `.label-l`, on the right, 24 above the frame bottom. */
async function expectActions(page: Page, frame: Box, cancel: Locator, primary: Locator, what: string): Promise<{ cancel: Box; primary: Box }> {
  const c = await box(cancel);
  const p = await box(primary);
  for (const [button, b, name] of [
    [cancel, c, 'Annulla'],
    [primary, p, 'primary'],
  ] as const) {
    near(b.height, 40, `${what} ${name} height`);
    await expectStyles(button, { 'padding-left': '24px', 'padding-right': '24px', 'border-top-left-radius': '20px' }, `${what} ${name}`);
    await expectFont(button, 'Roboto Flex', LABEL_L, `${what} ${name}`);
  }
  near(right(p), right(frame) - 24, `${what} primary on the right`);
  near(bottom(p), bottom(frame) - 24, `${what} actions at the bottom`);
  near(p.x - right(c), 8, `${what} gap between the actions`);
  near(c.y, p.y, `${what} actions on one row`);
  await expectStyles(cancel, { color: await role(page, '--primary'), 'background-color': 'rgba(0, 0, 0, 0)', 'border-top-style': 'none' }, `${what} "Annulla"`);
  return { cancel: c, primary: p };
}

/** The 3 px `--primary` ring 2 px away from the element. */
async function expectRing(page: Page, target: Locator, what: string): Promise<void> {
  await expectStyles(target, { 'outline-style': 'solid', 'outline-width': '3px', 'outline-offset': '2px', 'outline-color': await role(page, '--primary') }, what);
}

/** A board radio row: 10 16 padding, 16 radius, a 36 badge, then the title over the detail, then (for "Recenti") the radio. */
async function expectBoardRow(page: Page, row: Locator, title: string, detail: string, options: { checked: boolean; radio: boolean }, what: string): Promise<Box> {
  const r = await box(row);
  await expectStyles(row, { 'padding-top': '10px', 'padding-bottom': '10px', 'padding-left': '16px', 'padding-right': '16px', 'border-top-left-radius': '16px' }, what);
  await expectStyles(
    row,
    options.checked
      ? { 'background-color': await role(page, '--secondary-container'), color: await role(page, '--on-secondary-container') }
      : { 'background-color': 'rgba(0, 0, 0, 0)' },
    `${what} background`,
  );
  const badge = await box(row.locator(':scope > *').first());
  near(badge.width, 36, `${what} badge width`);
  near(badge.height, 36, `${what} badge height`);
  near(badge.x, r.x + 16, `${what} badge 16 from the left`);
  near(centreY(badge), centreY(r), `${what} badge centred`);
  const name = row.getByText(title, { exact: true });
  const nameBox = await box(name);
  near(nameBox.x, right(badge) + 16, `${what} name 16 after the badge`);
  await expectFont(name, 'Roboto Flex', BODY_L, `${what} name`);
  const sub = row.getByText(detail, { exact: true });
  near((await box(sub)).y, bottom(nameBox), `${what} detail under the name`);
  await expectFont(sub, 'Roboto Mono', MONO_S, `${what} detail`);
  const subPaint = await textPaint(page, sub);
  const expectedSub = await channels(page, await role(page, options.checked ? '--on-secondary-container' : '--on-surface-variant'));
  expect(subPaint, `${what} detail colour`).toEqual({ rgb: expectedSub.slice(0, 3), alpha: options.checked ? 0.8 : 1 });
  if (options.radio) {
    const radio = row.getByRole('radio');
    const rb = await box(radio);
    near(rb.width, 20, `${what} radio width`);
    near(rb.height, 20, `${what} radio height`);
    near(right(rb), right(r) - 16 - RADIO_MARGIN.right, `${what} radio 16 + 3 from the right`);
    near(centreY(rb), centreY(r) + RADIO_MARGIN.top / 2, `${what} radio centred, moved by its top margin`);
    await expectStyles(radio, { 'accent-color': await role(page, '--primary') }, `${what} radio`);
  } else {
    await expect(row.getByRole('radio'), `${what} has no radio`).toHaveCount(0);
  }
  return r;
}

/** The "Recenti" heading look: `.label-l` in `--on-surface-variant`. */
async function expectSectionHeading(page: Page, heading: Locator, what: string): Promise<Box> {
  await expectFont(heading, 'Roboto Flex', LABEL_L, what);
  await expectStyles(heading, { color: await role(page, '--on-surface-variant') }, what);
  return box(heading);
}

/** The warning frame of the board stop confirmation: 360 wide, the icon in a 48 circle, the centred title 12 above the text. */
async function expectWarningFrame(page: Page, dialog: Locator, accent: 'error' | 'attn', title: string, what: string): Promise<{ frame: Box; text: Box }> {
  const frame = await expectBoardFrame(page, dialog, 360, what);
  const icon = firstIcon(dialog);
  const circle = icon.locator('xpath=..');
  const c = await box(circle);
  near(c.width, 48, `${what} circle width`);
  near(c.height, 48, `${what} circle height`);
  near(c.y, frame.y + 24, `${what} circle on top`);
  near(centreX(c), centreX(frame), `${what} circle centred`);
  expect(['24px', '50%'], `${what} circle radius`).toContain((await styles(circle, ['border-top-left-radius']))['border-top-left-radius']);
  await expectStyles(
    circle,
    { 'background-color': await role(page, `--${accent}-container`), color: await role(page, `--on-${accent}-container`) },
    `${what} circle colours`,
  );
  const i = await box(icon);
  near(i.width, 24, `${what} icon width`);
  near(centreX(i), centreX(c), `${what} icon centred in the circle`);
  near(centreY(i), centreY(c), `${what} icon centred in the circle`);
  const titleBox = await expectTitle(page, dialog.getByRole('heading', { name: title, exact: true }), c, what);
  const textId = await dialog.getAttribute('aria-describedby');
  expect(textId, `${what} has a description`).toBeTruthy();
  const text = page.locator(`[id="${textId}"]`);
  const t = await box(text);
  near(t.y, bottom(titleBox) + 12, `${what} text 12 under the title`);
  await expectFont(text, 'Roboto Flex', BODY_M, `${what} text`);
  await expectStyles(text, { 'text-align': 'center', color: await role(page, '--on-surface-variant') }, `${what} text`);
  return { frame, text: t };
}

test.describe('new-session dialog', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44, REQ-45
  test('has the field, "Recenti" with each past folder once, most recent first, and "Annulla" and "Avvia sessione"', async ({ page }) => {
    const { billing, infra, docs } = await boardRecents();
    const requests = record(page, isPastSessionsRequest);
    await page.goto('/');
    await openChooser(page);

    await expect(pathField(page)).toBeVisible();
    await expect(chooser(page).getByText('Recenti', { exact: true })).toBeVisible();
    const radios = recents(page).getByRole('radio');
    await expect(radios).toHaveCount(3);
    const expected = [
      ['billing-api', billing],
      ['infra-terraform', infra],
      ['docs-site', docs],
    ];
    for (const [index, [name, folder]] of expected.entries()) {
      await expect(radios.nth(index)).toHaveAccessibleName(name!);
      await expect(radios.nth(index)).toHaveAccessibleDescription(folder!);
      await expect(rowOf(recents(page), name!)).toContainText(folder!);
    }
    await expect(action(chooser(page), 'Annulla')).toBeVisible();
    await expect(action(chooser(page), 'Avvia sessione')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests, 'the dialog asks the past sessions once').toHaveLength(1);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-45 and gatekeeper decision G4: no maximum, the list scrolls inside the dialog
  test('"Recenti" has no maximum, and only the dialog body scrolls', async ({ page }) => {
    const names: string[] = [];
    for (let i = 0; i < 14; i++) {
      const name = `progetto-${String(i).padStart(2, '0')}`;
      names.push(name);
      await pastSession(`board-many-${i}`, await newFolder(name), `Sessione ${i}`, new Date(Date.UTC(2026, 9, 30 - i, 10)));
    }
    await page.goto('/');
    await openChooser(page);

    const radios = recents(page).getByRole('radio');
    await expect(radios).toHaveCount(14);
    for (const [index, name] of names.entries()) await expect(radios.nth(index)).toHaveAccessibleName(name);

    const frame = await box(chooser(page));
    expect(frame.y, 'the frame keeps 48 px above').toBeGreaterThanOrEqual(48 - TOLERANCE);
    expect(bottom(frame), 'the frame keeps 48 px below').toBeLessThanOrEqual(900 - 48 + TOLERANCE);
    const fieldBefore = await box(pathField(page));
    const actionsBefore = await box(action(chooser(page), 'Avvia sessione'));
    expect(bottom(actionsBefore), 'the buttons are inside the viewport').toBeLessThanOrEqual(900);

    await radios.last().scrollIntoViewIfNeeded();

    const last = await box(radios.last());
    expect(last.y, 'the last row shows inside the frame').toBeGreaterThanOrEqual(frame.y);
    expect(bottom(last), 'the last row shows inside the frame').toBeLessThanOrEqual(bottom(frame));
    near((await box(pathField(page))).y, fieldBefore.y, 'the field does not scroll');
    near((await box(action(chooser(page), 'Avvia sessione'))).y, actionsBefore.y, 'the buttons do not scroll');
    expect(await page.evaluate(() => window.scrollY), 'the page does not scroll').toBe(0);
  });

  // FolderChooser: with no past session, no "Recenti"; the dialog still works
  test('with no past session there is no "Recenti", and the folder browser works', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);

    await expect(chooser(page).getByText('Recenti', { exact: true })).toHaveCount(0);
    await expect(chooser(page).getByRole('radiogroup')).toHaveCount(0);
    await expect(chooser(page).getByText('Cartelle', { exact: true })).toBeVisible();
    await expect(action(chooser(page), '..')).toBeVisible();
  });

  // FolderChooser: a failed PastSessionListRoute hides "Recenti" and shows no error
  test('when the past sessions do not load there is no "Recenti" and no error', async ({ page }) => {
    await page.route('**/api/past-sessions', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' }));
    await page.goto('/');
    await openChooser(page);
    await page.waitForTimeout(300);

    await expect(chooser(page).getByText('Recenti', { exact: true })).toHaveCount(0);
    await expect(chooser(page).getByRole('radiogroup')).toHaveCount(0);
    await expect(chooser(page).getByRole('alert')).toHaveCount(0);
    await expect(action(chooser(page), '..')).toBeVisible();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-46: the field fills at once, the row is checked, then the listing follows
  test('choosing a recent folder fills the field at once, checks its row and lists that folder', async ({ page }) => {
    const { billing, infra, docs } = await boardRecents();
    await mkdir(path.join(infra, 'modules'));
    await page.goto('/');
    await openChooser(page);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === '/api/folders',
      async (route) => {
        await held;
        await route.continue();
      },
    );

    await rowOf(recents(page), 'infra-terraform').getByText('infra-terraform', { exact: true }).click();

    await expect(pathField(page)).toHaveValue(infra);
    await expect(recent(page, 'infra-terraform')).toBeChecked();
    await expect(recent(page, 'billing-api')).not.toBeChecked();
    await expect(recent(page, 'docs-site')).not.toBeChecked();
    release();
    await expect(action(chooser(page), 'modules')).toBeVisible();
    await expect(pathField(page)).toHaveValue(infra);

    await recent(page, 'infra-terraform').focus();
    await page.keyboard.press('ArrowDown');
    await expect(recent(page, 'docs-site')).toBeChecked();
    await expect(pathField(page)).toHaveValue(docs);

    await pathField(page).fill(`${billing} `);
    await expect(recent(page, 'billing-api'), 'the row of the trimmed field text is checked').toBeChecked();
    await expect(recent(page, 'docs-site')).not.toBeChecked();
  });

  // FolderChooser: Enter on a "Recenti" radio is "Avvia sessione"
  test('Enter on a recent folder starts the session in that folder', async ({ page }) => {
    const { infra } = await boardRecents();
    const starts = record(page, isStartRequest);
    await page.goto('/');
    await openChooser(page);
    await recent(page, 'infra-terraform').click();
    await expect(pathField(page)).toHaveValue(infra);
    await expect(loading(chooser(page))).toHaveCount(0);

    const started = page.waitForResponse((r) => isStartRequest(r.url(), r.request().method()));
    await recent(page, 'infra-terraform').press('Enter');
    const response = await started;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toEqual({ path: infra });
    startedIds.push(((await response.json()) as { id: string }).id);

    await expect(chooser(page)).toBeHidden();
    await expect(terminal(page)).toContainText(`CWD:${infra}`);
    expect(starts).toHaveLength(1);
  });

  // FolderChooser rule and gatekeeper decision: a recent folder that no longer exists stays in the field, with "La cartella non esiste."
  test('a recent folder that no longer exists stays in the field and shows "La cartella non esiste."', async ({ page }) => {
    const { docs } = await boardRecents();
    await page.goto('/');
    await openChooser(page);
    await rm(docs, { recursive: true });

    await recent(page, 'docs-site').click();

    await expect(chooser(page).getByRole('alert')).toHaveText('La cartella non esiste.');
    await expect(pathField(page)).toHaveValue(docs);
    await expect(recent(page, 'docs-site')).toBeChecked();
    await expect(chooser(page)).toBeVisible();
  });

  // Dialog: a radio group is one Tab stop, the checked radio or any radio when none is checked
  test('Tab enters "Recenti" once and leaves it with the next Tab, both with and without a checked row', async ({ page }) => {
    await boardRecents();
    await page.goto('/');
    await openChooser(page);
    const radioInGroup = () => recents(page).evaluate((group) => group.contains(document.activeElement) && document.activeElement?.getAttribute('type') === 'radio');

    await expect(pathField(page)).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await radioInGroup(), 'with no checked row, Tab from the field lands on a radio').toBe(true);
    await page.keyboard.press('Tab');
    expect(await radioInGroup(), 'the next Tab leaves the group').toBe(false);
    expect(await chooser(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await recent(page, 'infra-terraform').click();
    await expect(loading(chooser(page))).toHaveCount(0);
    await pathField(page).focus();
    await page.keyboard.press('Tab');
    await expect(recent(page, 'infra-terraform'), 'Tab lands on the checked radio').toBeFocused();
    await page.keyboard.press('Tab');
    expect(await radioInGroup(), 'the next Tab leaves the group').toBe(false);
    await page.keyboard.press('Shift+Tab');
    await expect(recent(page, 'infra-terraform'), 'Shift+Tab comes back to the checked radio').toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(pathField(page)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(action(chooser(page), 'Avvia sessione'), 'Shift+Tab from the first stop wraps to the last').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(pathField(page), 'Tab from the last stop wraps to the first').toBeFocused();
  });

  // FolderChooser: an unchecked row or entry under the pointer gets an 8 % --on-surface layer
  test('an unchecked "Recenti" row and a "Cartelle" entry under the pointer show an 8 % layer', async ({ page }) => {
    await boardRecents();
    await page.goto('/');
    await openChooser(page);
    await recent(page, 'billing-api').click();
    await expect(loading(chooser(page))).toHaveCount(0);
    const surface = await channels(page, await role(page, '--dialog'));
    const layer = await channels(page, await role(page, '--on-surface'));

    for (const [what, row] of [
      ['"infra-terraform"', rowOf(recents(page), 'infra-terraform')],
      ['".."', action(chooser(page), '..')],
    ] as const) {
      const b = await box(row);
      const sample = { x: b.x + 6, y: centreY(b) };
      await page.mouse.move(0, 0);
      await expect.poll(() => pixel(page, sample.x, sample.y).then((p) => closeTo(p, surface.slice(0, 3))), `${what} without the pointer`).toBe(true);
      await page.mouse.move(centreX(b), centreY(b));
      const expected = blend(surface, layer, 0.08);
      await expect
        .poll(async () => {
          const p = await pixel(page, sample.x, sample.y);
          return closeTo(p, expected) ? 'ok' : `${p.slice(0, 3).join(',')} vs ${expected.join(',')}`;
        }, `${what} under the pointer`)
        .toBe('ok');
    }
  });
});

test.describe('resume history and running-elsewhere warning', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-49 — scenario "The user resumes a past session from the history"
  test('the resume history has the new-session layout, with one radio row per past session under its folder', async ({ page }) => {
    const billing = await newFolder('billing-api');
    const docs = await newFolder('docs-site');
    await pastSession('board-history-1', billing, "Aggiungi la validazione dell'IBAN", new Date('2026-11-03T10:00:00Z'));
    await pastSession('board-history-2', billing, 'Correggi il calcolo delle commissioni', new Date('2026-11-02T10:00:00Z'));
    await pastSession('board-history-3', docs, 'Aggiorna la guida', new Date('2026-11-01T10:00:00Z'));
    await runInTerminal('board-history-3');
    await page.goto('/');
    await openHistory(page);
    await page.mouse.move(0, 0);

    const frame = await expectBoardFrame(page, history(page), 520, 'resume history');
    const icon = await box(firstIcon(history(page)));
    near(icon.width, 24, 'icon width');
    near(icon.y, frame.y + 24, 'icon on top');
    near(centreX(icon), centreX(frame), 'icon centred');
    await expectStyles(firstIcon(history(page)), { color: await role(page, '--primary') }, 'icon colour');
    await expectTitle(page, history(page).getByRole('heading', { name: 'Riprendi sessione', exact: true }), icon, 'resume history');
    await expect(history(page), 'no description').toHaveAccessibleDescription('');

    await expect(pastSessions(page)).toBeVisible();
    const sections = pastSessions(page).getByRole('region');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0)).toHaveAccessibleName(billing);
    await expect(sections.nth(1)).toHaveAccessibleName(docs);
    await expectSectionHeading(page, history(page).getByText(billing, { exact: true }), 'billing-api heading');

    const radios = pastSessions(page).getByRole('radio');
    await expect(radios).toHaveCount(3);
    await expect(pastSessions(page).getByRole('radio', { checked: true })).toHaveCount(0);
    const first = history(page).getByRole('radio', { name: "Aggiungi la validazione dell'IBAN", exact: true });
    await expect(first).toHaveAccessibleDescription(/03\/11\/2026/);
    const firstRow = sections.nth(0).locator('*').filter({ has: page.getByRole('radio', { name: "Aggiungi la validazione dell'IBAN", exact: true }) }).filter({ hasText: "Aggiungi la validazione dell'IBAN" }).last();
    const date = (await first.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby')?.split(' ')[0] ?? '')?.textContent)) ?? '';
    await expectBoardRow(page, firstRow, "Aggiungi la validazione dell'IBAN", date, { checked: false, radio: true }, 'unchecked session row');

    await first.click();
    await expect(first).toBeChecked();
    await page.mouse.move(0, 0);
    await expectBoardRow(page, firstRow, "Aggiungi la validazione dell'IBAN", date, { checked: true, radio: true }, 'checked session row');

    const running = history(page).getByRole('radio', { name: 'Aggiorna la guida', exact: true });
    await expect(running).toHaveAccessibleDescription(/In esecuzione in un terminale/);
    const chip = history(page).getByText('In esecuzione in un terminale', { exact: true });
    await expect(chip).toBeVisible();
    await expectFont(chip, 'Roboto Flex', LABEL_L, 'running chip');
    await expectStyles(chip, { 'background-color': await role(page, '--attn-container'), color: await role(page, '--on-attn-container') }, 'running chip colours');
    await expect(chip.locator('svg'), 'the chip has the terminal icon').toHaveCount(1);
    const runningDate = (await running.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby')?.split(' ')[0] ?? '')?.textContent)) ?? '';
    near((await box(chip)).y, bottom(await box(history(page).getByText(runningDate, { exact: true }))) + 4, 'chip 4 under the date');

    await expectActions(page, frame, action(history(page), 'Annulla'), action(history(page), 'Riprendi'), 'resume history');
    await expectStyles(action(history(page), 'Riprendi'), { 'background-color': await role(page, '--primary'), color: await role(page, '--on-primary') }, '"Riprendi"');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-50 — scenario "The user sees the amber running-elsewhere warning"
    test(`${colorScheme} theme: the running-elsewhere warning has the stop-confirmation layout in amber, with "Annulla" focused`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      const folder = await newFolder('billing-api');
      await pastSession('board-warning', folder, 'Sessione nel terminale', new Date('2026-11-03T10:00:00Z'));
      await runInTerminal('board-warning');
      await page.goto('/');
      await openHistory(page);
      await history(page).getByRole('radio', { name: 'Sessione nel terminale', exact: true }).click();

      await action(history(page), 'Riprendi').click();

      await expect(warning(page)).toBeVisible();
      await expect(action(warning(page), 'Annulla')).toBeFocused();
      await page.mouse.move(0, 0);
      const { frame, text } = await expectWarningFrame(page, warning(page), 'attn', 'Sessione in esecuzione in un terminale', 'warning');
      await expect(warning(page)).toHaveAccessibleDescription(
        'Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono danneggiare la conversazione.',
      );
      const actions = await expectActions(page, frame, action(warning(page), 'Annulla'), action(warning(page), 'Riprendi comunque'), 'warning');
      near(actions.cancel.y, bottom(text) + 24, 'actions 24 under the text');
      await expectStyles(
        action(warning(page), 'Riprendi comunque'),
        { color: await role(page, '--attn'), 'background-color': 'rgba(0, 0, 0, 0)', 'border-top-style': 'none' },
        '"Riprendi comunque"',
      );
      await expectRing(page, action(warning(page), 'Annulla'), '"Annulla" focused on open');
    });
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`board "Dialoghi", ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44, REQ-45, REQ-46, REQ-51, REQ-52 — scenario "The user picks a recent folder for a new session"
    test('the new-session dialog with the board sample data matches the board', async ({ page }) => {
      const { billing, infra, docs } = await boardRecents();
      await page.goto('/');
      await openChooser(page);
      await expect(recents(page).getByRole('radio').first()).toHaveAccessibleName('billing-api');

      await rowOf(recents(page), 'billing-api').click();

      await expect(pathField(page)).toHaveValue(billing);
      await expect(recent(page, 'billing-api')).toBeChecked();
      await expect(loading(chooser(page))).toHaveCount(0);
      await page.mouse.move(0, 0);
      const dialog = chooser(page);

      const frame = await expectBoardFrame(page, dialog, 520, 'new-session dialog');
      const iconBox = await box(firstIcon(dialog));
      near(iconBox.width, 24, 'icon width');
      near(iconBox.height, 24, 'icon height');
      near(iconBox.y, frame.y + 24, 'icon on top');
      near(centreX(iconBox), centreX(frame), 'icon centred');
      await expectStyles(firstIcon(dialog), { color: await role(page, '--primary') }, 'icon colour');
      const title = await expectTitle(page, dialog.getByRole('heading', { name: 'Nuova sessione', exact: true }), iconBox, 'new-session dialog');

      const description = dialog.getByText('Scegli il progetto in cui avviare Claude Code.', { exact: true });
      const descriptionBox = await box(description);
      near(descriptionBox.y, bottom(title) + 8, 'description 8 under the title');
      await expectFont(description, 'Roboto Flex', BODY_M, 'description');
      await expectStyles(description, { 'text-align': 'center', color: await role(page, '--on-surface-variant') }, 'description');

      const field = pathField(page).locator('xpath=..');
      const fieldBox = await box(field);
      near(fieldBox.y, bottom(descriptionBox) + 24, 'field 16 + 8 under the description');
      near(fieldBox.x, frame.x + 24, 'field left');
      near(fieldBox.width, frame.width - 48, 'field width');
      near(fieldBox.height, 56, 'field height');
      await expectStyles(
        field,
        {
          'border-top-width': '2px',
          'border-right-width': '2px',
          'border-bottom-width': '2px',
          'border-left-width': '2px',
          'border-top-style': 'solid',
          'border-top-color': await role(page, '--primary'),
          'border-bottom-color': await role(page, '--primary'),
          'border-top-left-radius': '4px',
          'padding-left': '16px',
          'padding-right': '12px',
        },
        'field box',
      );
      const fieldIcon = field.locator('svg');
      const fieldIconBox = await box(fieldIcon);
      near(fieldIconBox.width, 20, 'field icon width');
      near(fieldIconBox.x, fieldBox.x + 2 + 16, 'field icon after the border and padding');
      near(centreY(fieldIconBox), centreY(fieldBox), 'field icon centred');
      await expectStyles(fieldIcon, { color: await role(page, '--on-surface-variant') }, 'field icon colour');
      const inputBox = await box(pathField(page));
      near(inputBox.x, right(fieldIconBox) + 12, 'input 12 after the icon');
      near(right(inputBox), right(fieldBox) - 2 - 12, 'input up to the padding');
      await expectFont(pathField(page), 'Roboto Flex', BODY_M, 'field value');
      await pathField(page).focus();
      await expectStyles(
        pathField(page),
        { color: await role(page, '--on-surface'), 'border-top-style': 'none', 'background-color': 'rgba(0, 0, 0, 0)', 'outline-style': 'none', 'box-shadow': 'none' },
        'field value, focused',
      );
      const label = dialog.getByText('Cartella del progetto', { exact: true });
      const labelBox = await box(label);
      near(labelBox.y, fieldBox.y - 8, 'label on the top border');
      near(labelBox.x, fieldBox.x + 12, 'label 12 from the left');
      near(labelBox.height, 16, 'label height');
      await expectFont(label, 'Roboto Flex', LABEL_M, 'label');
      await expectStyles(
        label,
        { color: await role(page, '--primary'), 'background-color': await role(page, '--dialog'), 'padding-left': '4px', 'padding-right': '4px' },
        'label',
      );

      const recentHeading = await expectSectionHeading(page, dialog.getByText('Recenti', { exact: true }), '"Recenti"');
      near(recentHeading.y, bottom(fieldBox) + 16 + 4, '"Recenti" 16 + 4 under the field');
      near(recentHeading.x, frame.x + 24, '"Recenti" on the left');
      const groupBox = await box(recents(page));
      near(groupBox.y, bottom(recentHeading) + 16, 'rows 16 under "Recenti"');
      let previous: Box | undefined;
      for (const [name, folder, checked] of [
        ['billing-api', billing, true],
        ['infra-terraform', infra, false],
        ['docs-site', docs, false],
      ] as const) {
        const row = rowOf(recents(page), name);
        const r = await expectBoardRow(page, row, name, folder, { checked, radio: true }, `row "${name}"`);
        near(r.x, frame.x + 24, `row "${name}" left`);
        near(r.width, frame.width - 48, `row "${name}" width`);
        near(r.height, 60, `row "${name}" height`);
        if (previous) near(r.y, bottom(previous) + 4, `row "${name}" 4 under the previous one`);
        previous = r;
      }

      const folders = await expectSectionHeading(page, dialog.getByText('Cartelle', { exact: true }), '"Cartelle"');
      near(folders.y, bottom(groupBox) + 16 + 4, '"Cartelle" 16 + 4 under the rows, as the "Recenti" heading');
      const parent = action(dialog, '..');
      await expect(parent).toHaveAccessibleDescription(path.dirname(billing));
      await expectBoardRow(page, parent, '..', path.dirname(billing), { checked: false, radio: false }, '".." entry');
      const parentIcon = parent.locator(':scope > *').first().locator('svg');
      near((await box(parentIcon)).width, 20, '".." folder icon width');
      await expectStyles(parentIcon, { color: await role(page, '--on-surface-variant') }, '".." folder icon');

      const actions = await expectActions(page, frame, action(dialog, 'Annulla'), action(dialog, 'Avvia sessione'), 'new-session dialog');
      near(actions.cancel.y, bottom(await box(parent)) + 16 + 8, 'actions 16 + 8 under the body');
      await expectStyles(action(dialog, 'Avvia sessione'), { 'background-color': await role(page, '--primary'), color: await role(page, '--on-primary') }, '"Avvia sessione"');

      await pathField(page).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(action(dialog, 'Avvia sessione')).toBeFocused();
      await expectRing(page, action(dialog, 'Avvia sessione'), '"Avvia sessione" with the keyboard focus');
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-47, REQ-48, REQ-52 — scenario "The user cancels a stop with Enter"
    test('the stop confirmation of a working "billing-api" matches the board, and Enter on the focused "Annulla" keeps it working', async ({ page, request }) => {
      const { id, folder } = await openWorkingSession(page, request, 'billing-api');
      const stops = record(page, (url, method) => new URL(url).pathname === `/api/sessions/${id}/stop` && method === 'POST');

      await page.getByRole('button', { name: 'Termina', exact: true }).first().click();

      await expect(confirmation(page)).toBeVisible();
      await expect(action(confirmation(page), 'Annulla')).toBeFocused();
      await page.mouse.move(0, 0);
      const { frame, text } = await expectWarningFrame(page, confirmation(page), 'error', 'Terminare la sessione?', 'stop confirmation');
      await expect(confirmation(page)).toHaveAccessibleDescription(`billing-api ${STOP_TEXT}`);
      const name = confirmation(page).getByText('billing-api', { exact: true });
      expect(Number((await styles(name, ['font-weight']))['font-weight']), 'the folder name is bold').toBeGreaterThanOrEqual(700);
      await expectStyles(name, { color: await role(page, '--on-surface') }, 'the folder name');
      const actions = await expectActions(page, frame, action(confirmation(page), 'Annulla'), action(confirmation(page), 'Termina'), 'stop confirmation');
      near(actions.cancel.y, bottom(text) + 24, 'actions 16 + 8 under the text');
      await expectStyles(
        action(confirmation(page), 'Termina'),
        { color: await role(page, '--error'), 'background-color': 'rgba(0, 0, 0, 0)', 'border-top-style': 'none' },
        '"Termina"',
      );
      await expectRing(page, action(confirmation(page), 'Annulla'), '"Annulla" focused on open');

      await page.keyboard.press('Enter');

      await expect(confirmation(page)).toBeHidden();
      await page.waitForTimeout(500);
      await expect(listEntry(page, folder)).toContainText('Lavora');
      expect(stops).toEqual([]);
    });

    // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-51: every dialog darkens the page behind it with black at 32 %
    test('every dialog darkens the page behind it with the board scrim', async ({ page, request }) => {
      const point = { x: 5, y: 450 };
      const darkened = async (before: Rgba, what: string) => {
        const expected = blend(before, [0, 0, 0, 255], 0.32);
        await expect
          .poll(async () => {
            const p = await pixel(page, point.x, point.y);
            return closeTo(p, expected) ? 'ok' : `${p.slice(0, 3).join(',')} vs ${expected.join(',')}`;
          }, `${what}: the page is darkened`)
          .toBe('ok');
      };

      const pastFolder = await newFolder('docs-site');
      await pastSession('board-scrim', pastFolder, 'Sessione nel terminale', new Date('2026-11-03T10:00:00Z'));
      await runInTerminal('board-scrim');
      await openWorkingSession(page, request, 'billing-api');
      await page.mouse.move(0, 0);
      const page0 = await pixel(page, point.x, point.y);

      await railButton(page, 'Nuova sessione').click();
      await expect(chooser(page)).toBeVisible();
      await darkened(page0, 'new-session dialog');
      await page.keyboard.press('Escape');
      await expect(chooser(page)).toBeHidden();

      await page.getByRole('button', { name: 'Termina', exact: true }).first().click();
      await expect(confirmation(page)).toBeVisible();
      await darkened(page0, 'stop confirmation');
      await page.keyboard.press('Escape');
      await expect(confirmation(page)).toBeHidden();

      await openHistory(page);
      await darkened(page0, 'resume history');
      const historyFrame = await box(history(page));
      const historyPoint = { x: historyFrame.x + 10, y: historyFrame.y + 40 };
      const historyPixel = await pixel(page, historyPoint.x, historyPoint.y);
      await history(page).getByRole('radio', { name: 'Sessione nel terminale', exact: true }).click();
      await action(history(page), 'Riprendi').click();
      await expect(warning(page)).toBeVisible();
      await page.mouse.move(0, 0);
      const warningBox = await box(warning(page));
      expect(historyPoint.x < warningBox.x || historyPoint.y < warningBox.y, 'the sample point is outside the warning').toBe(true);
      const expected = blend(historyPixel, [0, 0, 0, 255], 0.32);
      await expect
        .poll(async () => {
          const p = await pixel(page, historyPoint.x, historyPoint.y);
          return closeTo(p, expected) ? 'ok' : `${p.slice(0, 3).join(',')} vs ${expected.join(',')}`;
        }, 'warning: the resume history behind it is darkened')
        .toBe('ok');
    });
  });
}
