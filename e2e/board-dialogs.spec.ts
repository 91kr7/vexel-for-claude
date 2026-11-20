// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch dialogs, brought to the Studio modal (`#modal-new-session`)
// of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
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
// `--shadow-frame` of ThemeTokens (plan-dark_blue_theme).
const SHADOW_FRAME = 'rgba(0, 0, 0, 0.45) 0px 8px 24px -4px';
const MONO = /^"?Roboto Mono"?,/;
const STOP_TEXT = 'is still working. The current turn will be interrupted. You can resume the conversation from the history.';

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

const railButton = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name, exact: true });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });
const pathField = (page: Page) => page.getByRole('textbox', { name: 'Working Directory Path', exact: true });
const recents = (page: Page) => chooser(page).getByRole('radiogroup', { name: 'Recent Projects' });
const recent = (page: Page, name: string) => recents(page).getByRole('radio', { name, exact: true });
/** A row of a radio group: a direct child of the group that holds the radio. */
const rowOf = (group: Locator, name: string) => group.locator(':scope > *').filter({ has: group.page().getByRole('radio', { name, exact: true }) });
const history = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const pastSessions = (page: Page) => history(page).getByRole('radiogroup', { name: 'Past Sessions' });
const confirmation = (page: Page) => page.getByRole('alertdialog', { name: 'Terminate the Session?' });
const warning = (page: Page) => page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
const action = (dialog: Locator, name: string) => dialog.getByRole('button', { name, exact: true });
const loading = (scope: Locator) => scope.getByRole('status').filter({ hasText: 'Loading…' });
const listEntry = (page: Page, folder: string) => page.getByRole('region', { name: 'Session List' }).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => page.locator('.xterm-rows');

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

/** The "Recent" sample of the board: "billing-api" (latest, two sessions), then "infra-terraform", then "docs-site". */
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
  await railButton(page, 'New Claude Code Session').click();
  await expect(chooser(page)).toBeVisible();
  await expect(pathField(page)).toHaveValue(os.homedir());
  await expect(loading(chooser(page))).toHaveCount(0);
}

async function openHistory(page: Page): Promise<void> {
  await railButton(page, 'Resume').click();
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
  await expect(listEntry(page, folder)).toContainText('Running');
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

/** Polls, so a colour transition (0.12 s on the rows) settles before the comparison. */
async function expectStyles(target: Locator, expected: Record<string, string>, what: string): Promise<void> {
  await expect.poll(() => styles(target, Object.keys(expected)), { message: what }).toEqual(expected);
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

async function expectMono(target: Locator, what: string): Promise<void> {
  expect((await styles(target, ['font-family']))['font-family'], `${what}: mono`).toMatch(MONO);
}

/** Waits for the opening fade and zoom of the dialog (plan-ui_transitions/REQ-1): sizes and colours are measured at rest. */
async function settled(dialog: Locator): Promise<void> {
  await dialog.evaluate((el) =>
    Promise.all(
      (el.closest('.modal-backdrop') ?? el)
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}

/** The mock modal frame (Dialog "Shows"): at most `maxWidth` wide, centred, popup glass, strong border, 8 radius, frame shadow. */
async function expectStudioFrame(page: Page, frame: Locator, what: string, maxWidth = 448): Promise<Box> {
  await settled(frame);
  const b = await box(frame);
  expect(b.width, `${what} width`).toBeLessThanOrEqual(maxWidth + TOLERANCE);
  near(centreX(b), 720, `${what} horizontal centre`);
  near(b.y, 900 - bottom(b), `${what} vertical centring (space above vs below)`);
  await expectStyles(frame, { 'border-top-left-radius': '8px' }, `${what} frame`);
  // Dialog: the glass and its border are painted on a layer behind the content (WebEntry `.vx-popup-glass`).
  const glass = await frame.evaluate((el) => {
    const s = getComputedStyle(el, '::before');
    return { 'background-color': s.backgroundColor, 'border-top-color': s.borderTopColor, 'border-top-left-radius': s.borderTopLeftRadius };
  });
  expect(glass, `${what} frame glass`).toEqual({ 'background-color': await role(page, '--popup-glass-bg'), 'border-top-color': await role(page, '--border-strong'), 'border-top-left-radius': '8px' });
  expect((await styles(frame, ['box-shadow']))['box-shadow'], `${what} frame shadow`).toContain(SHADOW_FRAME);
  return b;
}

/** The header (Dialog "Shows"): the 8 px accent dot, the 14/600 title, "[Esc]" in mono muted on the right, a subtle line below. */
async function expectStudioHeader(page: Page, dialog: Locator, title: string, what: string): Promise<Box> {
  await settled(dialog);
  const heading = dialog.getByRole('heading', { name: title, exact: true });
  await expectStyles(heading, { 'font-size': '14px', 'font-weight': '600' }, `${what} title`);
  const dot = await heading.evaluate((el) => {
    const d = el.previousElementSibling;
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { width: r.width, height: r.height, background: getComputedStyle(d).backgroundColor, hidden: d.getAttribute('aria-hidden') };
  });
  expect(dot, `${what} accent dot`).toEqual({ width: 8, height: 8, background: await role(page, '--accent-primary'), hidden: 'true' });
  const esc = action(dialog, 'Close (Esc)');
  await expect(esc).toHaveText('[Esc]');
  await expectStyles(esc, { 'font-size': '12px', color: await role(page, '--text-muted') }, `${what} "[Esc]"`);
  await expectMono(esc, `${what} "[Esc]"`);
  const titleBox = await box(heading);
  expect((await box(esc)).x, `${what} "[Esc]" on the right of the title`).toBeGreaterThan(right(titleBox));
  await expectStyles(heading.locator('xpath=..'), { 'border-bottom-color': await role(page, '--border-subtle'), 'padding-top': '12px', 'padding-left': '16px' }, `${what} header`);
  await expect(dialog.locator('svg').first().locator('xpath=ancestor::*[contains(@class, "dialog-header")]'), `${what}: no icon in the header`).toHaveCount(0);
  return titleBox;
}

/** The footer (Dialog "Shows"): no fill of its own, subtle line above, "Cancel" neutral, then the primary action 8 apart on the right. */
async function expectStudioFooter(page: Page, cancel: Locator, primary: Locator, what: string): Promise<{ cancel: Box; primary: Box }> {
  const footer = cancel.locator('xpath=..');
  const f = await box(footer);
  await expectStyles(
    footer,
    { 'background-color': 'rgba(0, 0, 0, 0)', 'border-top-color': await role(page, '--border-subtle'), 'padding-top': '12px', 'padding-right': '16px' },
    `${what} footer`,
  );
  const c = await box(cancel);
  const p = await box(primary);
  near(right(p), right(f) - 16, `${what} primary on the right`);
  near(p.x - right(c), 8, `${what} gap between the actions`);
  near(centreY(c), centreY(p), `${what} actions on one row`);
  await expectStyles(
    cancel,
    { 'background-color': await role(page, '--bg-surface-2'), color: await role(page, '--text-primary'), 'border-top-left-radius': '8px', 'font-size': '12px' },
    `${what} "Cancel"`,
  );
  return { cancel: c, primary: p };
}

/** The 2 px `--accent-primary` ring 2 px away from the element (WebEntry). */
async function expectRing(page: Page, target: Locator, what: string): Promise<void> {
  await expectStyles(target, { 'outline-style': 'solid', 'outline-width': '2px', 'outline-offset': '2px', 'outline-color': await role(page, '--accent-primary') }, what);
}

/**
 * A dialog row of FolderChooser or ResumeDialog: a 24 badge, the 12 px name over the mono 11 px detail, then the 14 px radio.
 * With `card`, a card of ListStyles (plan-dark_blue_theme/REQ-44, REQ-45); else a dense folder browser row: padding 4 8, 7 px corners (REQ-47).
 */
async function expectStudioRow(
  page: Page,
  row: Locator,
  title: string,
  detail: string,
  options: { checked: boolean; radio: boolean; card?: boolean },
  what: string,
): Promise<Box> {
  const r = await box(row);
  if (options.card) {
    await expectStyles(
      row,
      options.checked
        ? { 'border-top-left-radius': '7px', 'border-left-width': '1px', 'background-color': await role(page, '--bg-surface-3'), 'border-top-color': await role(page, '--accent-primary') }
        : { 'border-top-left-radius': '7px', 'border-left-width': '1px', 'background-color': await role(page, '--bg-surface-2'), 'border-top-color': await role(page, '--border-subtle') },
      what,
    );
  } else {
    await expectStyles(row, { 'padding-top': '4px', 'padding-left': '8px', 'border-top-left-radius': '7px', 'background-color': 'rgba(0, 0, 0, 0)' }, what);
  }
  const badge = await box(row.locator(':scope > *').first());
  near(badge.width, 24, `${what} badge width`);
  near(badge.height, 24, `${what} badge height`);
  const name = row.getByText(title, { exact: true });
  const nameBox = await box(name);
  expect(nameBox.x, `${what} name after the badge`).toBeGreaterThan(right(badge));
  await expectStyles(name, { 'font-size': '12px' }, `${what} name`);
  const sub = row.getByText(detail, { exact: true });
  expect((await box(sub)).y, `${what} detail under the name`).toBeGreaterThanOrEqual(bottom(nameBox) - TOLERANCE);
  await expectStyles(sub, { 'font-size': '11px', color: await role(page, options.checked ? '--text-secondary' : '--text-muted') }, `${what} detail`);
  await expectMono(sub, `${what} detail`);
  if (options.radio) {
    const radio = row.getByRole('radio');
    const rb = await box(radio);
    near(rb.width, 14, `${what} radio width`);
    near(rb.height, 14, `${what} radio height`);
    expect(rb.x, `${what} radio on the right`).toBeGreaterThan(right(nameBox));
    await expectStyles(radio, { 'accent-color': await role(page, '--accent-primary') }, `${what} radio`);
  } else {
    await expect(row.getByRole('radio'), `${what} has no radio`).toHaveCount(0);
  }
  return r;
}

/** A section label (WebEntry `.section-label`): mono 10 px in `--text-muted`; uppercase unless it is a path. */
async function expectSectionHeading(page: Page, heading: Locator, path: boolean, what: string): Promise<Box> {
  await expectStyles(heading, { 'font-size': '10px', color: await role(page, '--text-muted'), 'text-transform': path ? 'none' : 'uppercase' }, what);
  await expectMono(heading, what);
  return box(heading);
}

/** WarningDialog "Shows": the frame with no icon; `error` → the text in the body; `attn` → the text in the amber banner with its triangle. */
async function expectWarningFrame(page: Page, dialog: Locator, accent: 'error' | 'attn', title: string, what: string): Promise<{ frame: Box; text: Box }> {
  const frame = await expectStudioFrame(page, dialog, what);
  await expectStudioHeader(page, dialog, title, what);
  const textId = await dialog.getAttribute('aria-describedby');
  expect(textId, `${what} has a description`).toBeTruthy();
  const text = page.locator(`[id="${textId}"]`);
  const t = await box(text);
  if (accent === 'error') {
    await expect(dialog.locator('svg'), `${what}: no icon`).toHaveCount(0);
    await expectStyles(text, { 'font-size': '12px', color: await role(page, '--text-secondary') }, `${what} text`);
  } else {
    const banner = text.locator('xpath=ancestor::*[contains(@class, "vx-surface-2")][1]');
    await expectStyles(
      banner,
      { 'border-top-color': 'rgba(245, 158, 11, 0.4)', 'border-top-left-radius': '7px', 'padding-top': '14px', 'padding-left': '14px' },
      `${what} amber banner`,
    );
    expect((await styles(banner, ['box-shadow']))['box-shadow'], `${what} banner card shadow`).toContain('rgba(0, 0, 0, 0.28) 0px 2px 10px 0px');
    const triangle = banner.locator('svg');
    await expect(triangle, `${what}: one triangle`).toHaveCount(1);
    near((await box(triangle)).width, 16, `${what} triangle width`);
    await expectStyles(triangle, { color: 'rgb(251, 191, 36)' }, `${what} triangle`);
    await expectStyles(text, { 'font-weight': '500', color: await role(page, '--text-primary') }, `${what} text`);
  }
  return { frame, text: t };
}

test.describe('new-session dialog', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44, REQ-45
  test('has the field, "Recent" with each past folder once, most recent first, and "Cancel" and "Start Session"', async ({ page }) => {
    const { billing, infra, docs } = await boardRecents();
    const requests = record(page, isPastSessionsRequest);
    await page.goto('/');
    await openChooser(page);

    await expect(pathField(page)).toBeVisible();
    await expect(chooser(page).getByText('Recent', { exact: true })).toBeVisible();
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
    await expect(action(chooser(page), 'Cancel')).toBeVisible();
    await expect(action(chooser(page), 'Start Session')).toBeVisible();
    await page.waitForTimeout(300);
    expect(requests, 'the dialog asks the past sessions once').toHaveLength(1);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-45 and gatekeeper decision G4: no maximum, the list scrolls inside the dialog
  test('"Recent" has no maximum, and only the dialog body scrolls', async ({ page }) => {
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

    // Dialog "Shows": the backdrop pads the frame by 16 px. Measured once the opening zoom has settled.
    await settled(chooser(page));
    const frame = await box(chooser(page));
    expect(frame.y, 'the frame keeps 16 px above').toBeGreaterThanOrEqual(16 - TOLERANCE);
    expect(bottom(frame), 'the frame keeps 16 px below').toBeLessThanOrEqual(900 - 16 + TOLERANCE);
    const fieldBefore = await box(pathField(page));
    const actionsBefore = await box(action(chooser(page), 'Start Session'));
    expect(bottom(actionsBefore), 'the buttons are inside the viewport').toBeLessThanOrEqual(900);

    await radios.last().scrollIntoViewIfNeeded();

    const last = await box(radios.last());
    expect(last.y, 'the last row shows inside the frame').toBeGreaterThanOrEqual(frame.y);
    expect(bottom(last), 'the last row shows inside the frame').toBeLessThanOrEqual(bottom(frame));
    near((await box(pathField(page))).y, fieldBefore.y, 'the field does not scroll');
    near((await box(action(chooser(page), 'Start Session'))).y, actionsBefore.y, 'the buttons do not scroll');
    expect(await page.evaluate(() => window.scrollY), 'the page does not scroll').toBe(0);
  });

  // FolderChooser: with no past session, no "Recent"; the dialog still works
  test('with no past session there is no "Recent", and the folder browser works', async ({ page }) => {
    await page.goto('/');
    await openChooser(page);

    await expect(chooser(page).getByText('Recent', { exact: true })).toHaveCount(0);
    await expect(chooser(page).getByRole('radiogroup')).toHaveCount(0);
    await expect(chooser(page).getByText('Folders', { exact: true })).toBeVisible();
    await expect(action(chooser(page), '..')).toBeVisible();
  });

  // FolderChooser: a failed PastSessionListRoute hides "Recent" and shows no error
  test('when the past sessions do not load there is no "Recent" and no error', async ({ page }) => {
    await page.route('**/api/past-sessions', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' }));
    await page.goto('/');
    await openChooser(page);
    await page.waitForTimeout(300);

    await expect(chooser(page).getByText('Recent', { exact: true })).toHaveCount(0);
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

  // FolderChooser: Enter on a "Recent" radio is "Start Session"
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

  // FolderChooser rule and gatekeeper decision: a recent folder that no longer exists stays in the field, with "The folder does not exist."
  test('a recent folder that no longer exists stays in the field and shows "The folder does not exist."', async ({ page }) => {
    const { docs } = await boardRecents();
    await page.goto('/');
    await openChooser(page);
    await rm(docs, { recursive: true });

    await recent(page, 'docs-site').click();

    await expect(chooser(page).getByRole('alert')).toHaveText('The folder does not exist.');
    await expect(pathField(page)).toHaveValue(docs);
    await expect(recent(page, 'docs-site')).toBeChecked();
    await expect(chooser(page)).toBeVisible();
  });

  // Dialog: a radio group is one Tab stop, the checked radio or any radio when none is checked
  test('Tab enters "Recent" once and leaves it with the next Tab, both with and without a checked row', async ({ page }) => {
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
    await expect(action(chooser(page), 'Close (Esc)'), 'Shift+Tab from the field reaches "[Esc]", the first stop').toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(action(chooser(page), 'Start Session'), 'Shift+Tab from the first stop wraps to the last').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(action(chooser(page), 'Close (Esc)'), 'Tab from the last stop wraps to the first').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(pathField(page)).toBeFocused();
  });

  // FolderChooser: an unchecked row or entry under the pointer gets surface 3. Without the pointer it keeps its own look:
  // the dialog behind it is now the popup glass (plan-popup_glass/REQ-1, REQ-5), so that look is no longer surface 2.
  test('an unchecked "Recent" row and a "Folders" entry under the pointer show surface 3', async ({ page }) => {
    await boardRecents();
    await page.goto('/');
    await openChooser(page);
    await recent(page, 'billing-api').click();
    await expect(loading(chooser(page))).toHaveCount(0);
    const hover = await channels(page, await role(page, '--bg-surface-3'));

    for (const [what, row] of [
      ['"infra-terraform"', rowOf(recents(page), 'infra-terraform')],
      ['".."', action(chooser(page), '..')],
    ] as const) {
      const b = await box(row);
      const sample = { x: b.x + 6, y: centreY(b) };
      await page.mouse.move(0, 0);
      await settled(chooser(page));
      await expect.poll(async () => closeTo(await pixel(page, sample.x, sample.y), hover.slice(0, 3)), `${what} without the pointer is not surface 3`).toBe(false);
      await page.mouse.move(centreX(b), centreY(b));
      const expected = hover.slice(0, 3);
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
  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8, REQ-12, REQ-43, REQ-44, REQ-47 — the resume history as the Studio modal
  test('the resume history has the Studio modal, with one radio row per past session under its mono path heading', async ({ page }) => {
    const billing = await newFolder('billing-api');
    const docs = await newFolder('docs-site');
    await pastSession('board-history-1', billing, "Aggiungi la validazione dell'IBAN", new Date('2026-11-03T10:00:00Z'));
    await pastSession('board-history-2', billing, 'Correggi il calcolo delle commissioni', new Date('2026-11-02T10:00:00Z'));
    await pastSession('board-history-3', docs, 'Aggiorna la guida', new Date('2026-11-01T10:00:00Z'));
    await runInTerminal('board-history-3');
    await page.goto('/');
    await openHistory(page);
    await page.mouse.move(0, 0);

    // The resume popup is 672 px wide (plan-resume_favorites/REQ-1).
    await expectStudioFrame(page, history(page), 'resume history', 672);
    await expectStudioHeader(page, history(page), 'Resume Session', 'resume history');
    await expect(history(page), 'no description').toHaveAccessibleDescription('');

    await expect(pastSessions(page)).toBeVisible();
    const sections = pastSessions(page).getByRole('region');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0)).toHaveAccessibleName(billing);
    await expect(sections.nth(1)).toHaveAccessibleName(docs);
    await expectSectionHeading(page, history(page).getByText(billing, { exact: true }), true, 'billing-api heading');

    const radios = pastSessions(page).getByRole('radio');
    await expect(radios).toHaveCount(3);
    await expect(pastSessions(page).getByRole('radio', { checked: true })).toHaveCount(0);
    const first = history(page).getByRole('radio', { name: "Aggiungi la validazione dell'IBAN", exact: true });
    await expect(first).toHaveAccessibleDescription(/03\/11\/2026/);
    const firstRow = sections.nth(0).locator('*').filter({ has: page.getByRole('radio', { name: "Aggiungi la validazione dell'IBAN", exact: true }) }).filter({ hasText: "Aggiungi la validazione dell'IBAN" }).last();
    const date = (await first.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby')?.split(' ')[0] ?? '')?.textContent)) ?? '';
    await expectStudioRow(page, firstRow, "Aggiungi la validazione dell'IBAN", date, { checked: false, radio: true, card: true }, 'unchecked session row');
    await expectStyles(firstRow.locator('.avatar'), { 'background-color': await role(page, '--bg-surface-3') }, 'neutral avatar');

    await first.click();
    await expect(first).toBeChecked();
    await page.mouse.move(0, 0);
    await expectStudioRow(page, firstRow, "Aggiungi la validazione dell'IBAN", date, { checked: true, radio: true, card: true }, 'checked session row');

    const running = history(page).getByRole('radio', { name: 'Aggiorna la guida', exact: true });
    await expect(running).toHaveAccessibleDescription(/Running in a terminal/);
    const chip = history(page).getByText('Running in a terminal', { exact: true });
    await expect(chip).toBeVisible();
    await expectMono(chip, 'running chip');
    await expectStyles(chip, { 'background-color': 'rgba(245, 158, 11, 0.15)', color: 'rgb(251, 191, 36)', 'font-size': '11px' }, 'running chip colours');
    await expect(chip.locator('svg'), 'the chip has the terminal icon').toHaveCount(1);
    near((await box(chip.locator('svg'))).width, 12, 'running chip icon width');
    const runningDate = (await running.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby')?.split(' ')[0] ?? '')?.textContent)) ?? '';
    near((await box(chip)).y, bottom(await box(history(page).getByText(runningDate, { exact: true }))) + 4, 'chip 4 under the date');

    await expectStudioFooter(page, action(history(page), 'Cancel'), action(history(page), 'Resume'), 'resume history');
    await expectStyles(action(history(page), 'Resume'), { 'background-color': await role(page, '--accent-primary'), color: await role(page, '--on-accent') }, '"Resume"');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49 — scenario "The running-elsewhere warning is drawn in amber"
    test(`${colorScheme} system theme: the running-elsewhere warning shows its text in the amber banner, "Resume Anyway" in amber and "Cancel" focused`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      const folder = await newFolder('billing-api');
      await pastSession('board-warning', folder, 'Sessione nel terminale', new Date('2026-11-03T10:00:00Z'));
      await runInTerminal('board-warning');
      await page.goto('/');
      await openHistory(page);
      await history(page).getByRole('radio', { name: 'Sessione nel terminale', exact: true }).click();

      await action(history(page), 'Resume').click();

      await expect(warning(page)).toBeVisible();
      await expect(action(warning(page), 'Cancel')).toBeFocused();
      await page.mouse.move(0, 0);
      await expectWarningFrame(page, warning(page), 'attn', 'Session Running in a Terminal', 'warning');
      await expect(warning(page)).toHaveAccessibleDescription(
        'This session is still running in another terminal. If you resume it here too, the two instances can damage the conversation.',
      );
      await expectStudioFooter(page, action(warning(page), 'Cancel'), action(warning(page), 'Resume Anyway'), 'warning');
      await expectStyles(
        action(warning(page), 'Resume Anyway'),
        { color: 'rgb(251, 191, 36)', 'background-color': 'rgba(245, 158, 11, 0.15)', 'border-top-color': 'rgba(245, 158, 11, 0.3)' },
        '"Resume Anyway"',
      );
      await expectMono(action(warning(page), 'Resume Anyway'), '"Resume Anyway"');
      await expectRing(page, action(warning(page), 'Cancel'), '"Cancel" focused on open');
    });
  }
});

test.describe('Studio dialogs', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12, REQ-43, REQ-44, REQ-46, REQ-47, REQ-52 — scenario "The new-session dialog uses the Studio modal"
  test('the new-session dialog with the sample data has the Studio modal, field, rows and footer', async ({ page }) => {
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

    // plan-new_session_popup/REQ-1: the new-session dialog has the width of the Resume popup.
    await expectStudioFrame(page, dialog, 'new-session dialog', 672);
    const title = await expectStudioHeader(page, dialog, 'New Claude Code Session', 'new-session dialog');

    const description = dialog.getByText('Choose the project where Claude Code starts.', { exact: true });
    const descriptionBox = await box(description);
    expect(descriptionBox.y, 'description under the header').toBeGreaterThan(bottom(title));
    await expectStyles(description, { 'font-size': '12px', color: await role(page, '--text-secondary') }, 'description');

    // REQ-46: the label above, mono 11 px; the mono input on canvas with the subtle border, no icon, accent border on focus
    const label = dialog.getByText('Working Directory Path', { exact: true });
    const labelBox = await box(label);
    const inputBox = await box(pathField(page));
    expect(bottom(labelBox), 'label above the input').toBeLessThanOrEqual(inputBox.y + TOLERANCE);
    near(inputBox.y - bottom(labelBox), 4, 'label 4 above the input');
    await expectStyles(label, { 'font-size': '11px', color: await role(page, '--text-secondary') }, 'label');
    await expectMono(label, 'label');
    await expect(pathField(page).locator('xpath=..').locator('svg'), 'no icon in the field').toHaveCount(0);
    await expectStyles(
      pathField(page),
      { 'font-size': '12px', 'background-color': await role(page, '--bg-canvas'), 'border-top-left-radius': '8px', 'padding-top': '8px', 'padding-left': '12px' },
      'input',
    );
    await expectMono(pathField(page), 'input');
    await pathField(page).blur();
    await expectStyles(pathField(page), { 'border-top-color': await role(page, '--border-strong') }, 'input, not focused');
    await pathField(page).focus();
    await expectStyles(pathField(page), { 'border-top-color': await role(page, '--accent-primary'), 'outline-style': 'none' }, 'input, focused');

    const recentHeading = await expectSectionHeading(page, dialog.getByText('Recent', { exact: true }), false, '"Recent"');
    expect(recentHeading.y, '"Recent" under the field').toBeGreaterThan(bottom(inputBox));
    let previous: Box | undefined;
    for (const [name, folder, checked] of [
      ['billing-api', billing, true],
      ['infra-terraform', infra, false],
      ['docs-site', docs, false],
    ] as const) {
      const row = rowOf(recents(page), name);
      const r = await expectStudioRow(page, row, name, folder, { checked, radio: true, card: true }, `row "${name}"`);
      await expectStyles(row, { 'padding-top': '6px', 'padding-left': '10px', ...(checked ? { 'font-weight': '600' } : {}) }, `row "${name}" padding and weight`);
      if (previous) near(r.y, bottom(previous) + 6, `row "${name}" 6 under the previous one`);
      previous = r;
    }
    expect(await rowOf(recents(page), 'billing-api').evaluate((el) => {
      const c = 'rgb(140, 207, 255)';
      const s = getComputedStyle(el);
      if (s.borderLeftColor === c && parseFloat(s.borderLeftWidth) >= 1.5) return true;
      if (s.boxShadow.includes(c)) return true;
      return ['::before', '::after'].some((p) => getComputedStyle(el, p).content !== 'none' && getComputedStyle(el, p).backgroundColor === c);
    }), 'checked row: the accent bar').toBe(true);

    await expectSectionHeading(page, dialog.getByText('Folders', { exact: true }), false, '"Folders"');
    const parent = action(dialog, '..');
    await expect(parent).toHaveAccessibleDescription(path.dirname(billing));
    // FolderChooser: the "Folders" entries are the same card as the "Recent" rows, never checked.
    await expectStudioRow(page, parent, '..', path.dirname(billing), { checked: false, radio: false, card: true }, '".." entry');
    const tile = parent.locator(':scope > *').first();
    await expectStyles(tile, { 'background-color': await role(page, '--bg-surface-3'), 'border-top-left-radius': '6px' }, '".." folder tile');
    near((await box(tile.locator('svg'))).width, 14, '".." folder icon width');
    await expectStyles(tile.locator('svg'), { color: await role(page, '--text-secondary') }, '".." folder icon');

    await expectStudioFooter(page, action(dialog, 'Cancel'), action(dialog, 'Start Session'), 'new-session dialog');
    await expectStyles(action(dialog, 'Start Session'), { 'background-color': await role(page, '--accent-primary'), color: await role(page, '--on-accent') }, '"Start Session"');

    await action(dialog, 'Close (Esc)').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(action(dialog, 'Start Session')).toBeFocused();
    await expectRing(page, action(dialog, 'Start Session'), '"Start Session" with the keyboard focus');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-48 — scenario "The stop confirmation is drawn in rose"
  test('the stop confirmation of a working "billing-api" has its main action in rose, and Enter on the focused "Cancel" keeps it working', async ({ page, request }) => {
    const { id, folder } = await openWorkingSession(page, request, 'billing-api');
    const stops = record(page, (url, method) => new URL(url).pathname === `/api/sessions/${id}/stop` && method === 'POST');

    await page.getByRole('main').getByRole('button', { name: 'Terminate', exact: true }).click();

    await expect(confirmation(page)).toBeVisible();
    await expect(action(confirmation(page), 'Cancel')).toBeFocused();
    await page.mouse.move(0, 0);
    await expectWarningFrame(page, confirmation(page), 'error', 'Terminate the Session?', 'stop confirmation');
    await expect(confirmation(page)).toHaveAccessibleDescription(`billing-api ${STOP_TEXT}`);
    const name = confirmation(page).getByText('billing-api', { exact: true });
    expect(Number((await styles(name, ['font-weight']))['font-weight']), 'the folder name is bold').toBeGreaterThanOrEqual(600);
    await expectStyles(name, { color: await role(page, '--text-primary') }, 'the folder name');
    await expectStudioFooter(page, action(confirmation(page), 'Cancel'), action(confirmation(page), 'Terminate'), 'stop confirmation');
    await expectStyles(
      action(confirmation(page), 'Terminate'),
      { color: 'rgb(251, 113, 133)', 'background-color': 'rgba(244, 63, 94, 0.15)', 'border-top-color': 'rgba(244, 63, 94, 0.3)' },
      '"Terminate"',
    );
    await expectRing(page, action(confirmation(page), 'Cancel'), '"Cancel" focused on open');

    await page.keyboard.press('Enter');

    await expect(confirmation(page)).toBeHidden();
    await page.waitForTimeout(500);
    await expect(listEntry(page, folder)).toContainText('Running');
    expect(stops).toEqual([]);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-43: every dialog darkens the page behind it with black at 65 %
  test('every dialog darkens the page behind it with black at 65 %', async ({ page, request }) => {
    const point = { x: 5, y: 450 };
    const darkened = async (before: Rgba, what: string) => {
      const expected = blend(before, [0, 0, 0, 255], 0.65);
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

    await railButton(page, 'New Claude Code Session').click();
    await expect(chooser(page)).toBeVisible();
    await darkened(page0, 'new-session dialog');
    await page.keyboard.press('Escape');
    await expect(chooser(page)).toBeHidden();

    await page.getByRole('main').getByRole('button', { name: 'Terminate', exact: true }).click();
    await expect(confirmation(page)).toBeVisible();
    await darkened(page0, 'stop confirmation');
    await page.keyboard.press('Escape');
    await expect(confirmation(page)).toBeHidden();

    await openHistory(page);
    await darkened(page0, 'resume history');
    await history(page).getByRole('radio', { name: 'Sessione nel terminale', exact: true }).click();
    await action(history(page), 'Resume').click();
    await expect(warning(page)).toBeVisible();
    await expect(warning(page).locator('xpath=..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.65)');
  });
});
