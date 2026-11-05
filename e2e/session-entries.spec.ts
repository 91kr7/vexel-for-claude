// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch session-list. The server runs the fake CLI (playwright.config.ts).
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };
const GROUPS = ['Richiedono input', 'In corso', 'In altri terminali', 'Terminate'];

let projectsRoot: string;
/** Folder of the current test: ended sessions of earlier tests stay on the server and must not show. */
let testRoot: string;
const createdIds: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.use({ colorScheme: 'light' });

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-entries-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
});

test.beforeEach(async () => {
  testRoot = await mkdtemp(path.join(projectsRoot, 'test-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  for (const { process, files } of terminals.splice(0)) {
    process.kill('SIGKILL');
    for (const file of files) await rm(file, { force: true });
  }
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Navigazione principale' });
const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('region', { name: 'Elenco sessioni' });
const byFolder = (page: Page, folder: string) => page.getByTitle(folder, { exact: true });
/** The entry button of a session: a row, or the top button of the hosted needs-input card. */
const entry = (page: Page, folder: string) => list(page).locator('.session-entry').filter({ has: byFolder(page, folder) });
const card = (page: Page, folder: string) => list(page).locator('.session-card').filter({ has: byFolder(page, folder) });
const item = (page: Page, folder: string) => list(page).getByRole('listitem').filter({ has: byFolder(page, folder) });
const headings = (page: Page) => list(page).getByRole('heading', { level: 2 });
const heading = (page: Page, title: string) => list(page).getByRole('heading', { level: 2, name: title, exact: true });
const groupItems = (page: Page, title: string) => heading(page, title).locator('xpath=following::ul[1]/li');
const badge = (target: Locator) => target.locator('.state-badge');
const avatar = (target: Locator) => target.locator('.avatar');
const counter = (page: Page) => list(page).getByRole('status').filter({ hasText: 'richiede input' });
const terminal = (page: Page) => page.locator('.xterm-rows');

/** Shows in the page only the sessions of this file: other spec files start sessions on the same server at the same time. */
async function showOnlyOwnSessions(page: Page): Promise<void> {
  const own = (session: { folder?: unknown } | undefined) => typeof session?.folder === 'string' && session.folder.startsWith(testRoot + path.sep);
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
  const folder = path.join(testRoot, name);
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

async function stopViaApi(request: APIRequestContext, id: string): Promise<void> {
  expect((await request.post(`/api/sessions/${id}/stop`)).ok()).toBe(true);
}

async function labelOf(request: APIRequestContext, id: string): Promise<string> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; label: string }[];
  const label = sessions.find((s) => s.id === id)?.label;
  expect(label, `session ${id} is listed`).toBeDefined();
  return label!;
}

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string, status = 'idle'): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  terminals.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  const waiting = status === 'waiting' ? { waitingFor: 'permission' } : {};
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status, ...waiting, updatedAt: Date.now() }));
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
}

/** Moves the pointer off the list, so no entry shows its hover layer. */
async function pointerAway(page: Page): Promise<void> {
  const main = await mainArea(page).boundingBox();
  expect(main).not.toBeNull();
  await page.mouse.move(main!.x + main!.width / 2, main!.y + main!.height - 4);
}

/** Computed colour of a theme token. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, `var(${name})`);
}

type Style = Record<string, string>;
const PROPS = [
  'color',
  'backgroundColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderLeftWidth',
  'borderLeftStyle',
  'borderLeftColor',
  'borderRadius',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'columnGap',
  'fontSize',
  'lineHeight',
  'fontWeight',
  'width',
  'height',
  'outlineStyle',
  'outlineWidth',
  'outlineColor',
  'boxShadow',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'opacity',
] as const;

async function styleOf(target: Locator): Promise<Style> {
  return target.evaluate((el, props) => {
    const s = getComputedStyle(el) as unknown as Record<string, string>;
    return Object.fromEntries(props.map((p) => [p, s[p] ?? '']));
  }, PROPS as unknown as string[]);
}

/** A radius that draws a full circle on a square of the given side. */
const isCircle = (radius: string, side: number) => radius === '50%' || parseFloat(radius) === side / 2;
const transparent = (colour: string) => colour === 'transparent' || /^rgba\(.*,\s*0\)$/.test(colour);

/** Row geometry of board "Voci dell'elenco": 12 px gap, padding 12 px 16 px, radius 16 px, 40 px avatar. */
async function expectBoardRow(row: Locator, name: string, radius = '16px'): Promise<void> {
  const s = await styleOf(row);
  expect([s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft], `${name}: padding`).toEqual(['12px', '16px', '12px', '16px']);
  expect(s.columnGap, `${name}: gap`).toBe('12px');
  expect(s.borderRadius, `${name}: radius`).toBe(radius);
  const box = await avatar(row).boundingBox();
  expect([box?.width, box?.height], `${name}: 40 px avatar`).toEqual([40, 40]);
}

/** Text styles of board "Voci dell'elenco": title-m folder name, body-m label, label-m state with a 14 px icon, body-s time. */
async function expectBoardText(page: Page, row: Locator, folder: string, name: string): Promise<void> {
  const title = await styleOf(row.getByTitle(folder, { exact: true }));
  expect([title.fontSize, title.lineHeight, title.fontWeight], `${name}: title-m`).toEqual(['16px', '24px', '500']);
  const state = await styleOf(badge(row));
  expect([state.fontSize, state.lineHeight], `${name}: label-m state`).toEqual(['12px', '16px']);
  const icon = await badge(row).locator('svg').boundingBox();
  expect([icon?.width, icon?.height], `${name}: 14 px state icon`).toEqual([14, 14]);
  const time = row.locator('time');
  if ((await time.count()) > 0) {
    const t = await styleOf(time);
    expect([t.fontSize, t.lineHeight, t.color], `${name}: body-s time`).toEqual(['12px', '16px', await token(page, '--on-surface-variant')]);
  }
}

const borderOf = (s: Style) => ({ width: s.borderTopWidth, style: s.borderTopStyle, colour: s.borderTopColor });
const hasNoBorder = (s: Style) => s.borderTopStyle === 'none' || s.borderTopWidth === '0px';

/** True when the target is drawn with a 2 px ring of the given colour, as an outline or an outer box-shadow. */
const hasRing = (s: Style, colour: string) =>
  (s.outlineStyle !== 'none' && s.outlineWidth === '2px' && s.outlineColor === colour) ||
  s.boxShadow.includes(`${colour} 0px 0px 0px 2px`);

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, REQ-17, REQ-19, REQ-20, REQ-22, REQ-23 — scenario "The user answers a waiting session from its card"
test('the user answers a waiting session from its amber card with "Rispondi"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const web = await newFolder('web-dashboard');
  const billing = await newFolder('billing-api');
  const webId = await startViaApi(request, web);
  await startViaApi(request, billing);
  await page.goto('/');
  await openFromList(page, billing);
  await postHook(request, webId, { hook_event_name: 'UserPromptSubmit', prompt: 'rimuovi le dipendenze inutilizzate' });
  await postHook(request, webId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

  await expect(headings(page)).toHaveText(['Richiedono input', 'In corso']);
  await expect(groupItems(page, 'Richiedono input')).toHaveCount(1);
  await expect(groupItems(page, 'Richiedono input').locator('.session-card').filter({ has: byFolder(page, web) })).toBeVisible();
  await expect(groupItems(page, 'In corso').filter({ has: byFolder(page, billing) })).toHaveCount(1);

  const webCard = card(page, web);
  await expect(avatar(webCard)).toHaveText('WD');
  await expect(entry(page, web)).toContainText('web-dashboard');
  await expect(entry(page, web)).toContainText('rimuovi le dipendenze inutilizzate');
  await expect(badge(webCard)).toHaveText('Richiede input');
  await expect(entry(page, web)).toHaveAccessibleDescription('Permesso per Bash · ora');
  expect(Number((await styleOf(webCard.getByText('Bash', { exact: true }))).fontWeight), 'tool name in bold').toBeGreaterThanOrEqual(700);
  await expect(terminal(page)).toContainText(`CWD:${billing}`);

  await webCard.getByRole('button', { name: 'Rispondi', exact: true }).click();
  await expect(terminal(page)).toContainText(`CWD:${web}`);
  await expect(entry(page, web)).toHaveAttribute('aria-current', 'true');
  await expect(entry(page, billing)).not.toHaveAttribute('aria-current', /.*/);
});

// SessionList "Actions": a click anywhere on the hosted needs-input card opens the session
test('a click on the needs-input line of the card opens the session', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const asks = await newFolder('card-click');
  const other = await newFolder('card-other');
  const asksId = await startViaApi(request, asks);
  await startViaApi(request, other);
  await page.goto('/');
  await openFromList(page, other);
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Write' });

  const line = await card(page, asks).getByText('Permesso per').boundingBox();
  await page.mouse.click(line!.x + line!.width / 2, line!.y + line!.height / 2);
  await expect(terminal(page)).toContainText(`CWD:${asks}`);
  await expect(entry(page, asks)).toHaveAttribute('aria-current', 'true');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22: the line names the tool of the permission prompt, or shows the label when no tool is known
test('the needs-input line names the waiting tool, or shows the label when no tool is known', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const prompted = await newFolder('line-prompt');
  const elicited = await newFolder('line-elicit');
  const promptedId = await startViaApi(request, prompted);
  const elicitedId = await startViaApi(request, elicited);
  await page.goto('/');
  await postHook(request, promptedId, { hook_event_name: 'PreToolUse', tool_name: 'Edit' });
  await postHook(request, promptedId, { hook_event_name: 'Notification', notification_type: 'permission_prompt' });
  await postHook(request, elicitedId, { hook_event_name: 'UserPromptSubmit', prompt: 'Scegli il database' });
  await postHook(request, elicitedId, { hook_event_name: 'Notification', notification_type: 'elicitation_dialog' });

  await expect(entry(page, prompted)).toHaveAccessibleDescription('Permesso per Edit · ora');
  await expect(entry(page, elicited)).toHaveAccessibleDescription('Scegli il database · ora');
  await expect(card(page, elicited)).not.toContainText('Permesso per');

  await postHook(request, promptedId, { hook_event_name: 'PostToolUse', tool_name: 'Edit' });
  await expect(card(page, prompted)).toHaveCount(0);
  await expect(groupItems(page, 'In corso').filter({ has: byFolder(page, prompted) })).toHaveCount(1);
  await expect(item(page, prompted)).not.toContainText('Permesso per');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, REQ-17, REQ-18: the groups in order, empty ones hidden, latest activity first
test('sessions sit in their groups, in order, latest activity first, and an empty group is hidden', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const older = await newFolder('grp-older');
  const newer = await newFolder('grp-newer');
  const asking = await newFolder('grp-asking');
  const ended = await newFolder('grp-ended');
  const outsideBusy = await newFolder('grp-outside-busy');
  const outsideWaiting = await newFolder('grp-outside-waiting');
  const olderId = await startViaApi(request, older);
  await page.goto('/');
  await expect(headings(page)).toHaveText(['In corso']);

  const newerId = await startViaApi(request, newer);
  await postHook(request, newerId, { hook_event_name: 'UserPromptSubmit', prompt: 'Lavora' });
  await expect(groupItems(page, 'In corso')).toHaveCount(2);
  await expect(groupItems(page, 'In corso').first()).toContainText('grp-newer');
  await postHook(request, olderId, { hook_event_name: 'UserPromptSubmit', prompt: 'Riprendi' });
  await expect(groupItems(page, 'In corso').first()).toContainText('grp-older');

  const askingId = await startViaApi(request, asking);
  await postHook(request, askingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await stopViaApi(request, await startViaApi(request, ended));
  await runInTerminal('e2e-groups-busy', outsideBusy, 'busy');
  await runInTerminal('e2e-groups-waiting', outsideWaiting, 'waiting');

  await expect(headings(page)).toHaveText(GROUPS, SCAN);
  await expect(groupItems(page, 'Richiedono input').filter({ has: byFolder(page, asking) })).toHaveCount(1);
  await expect(groupItems(page, 'Richiedono input').filter({ has: byFolder(page, outsideWaiting) })).toHaveCount(1);
  await expect(groupItems(page, 'Richiedono input')).toHaveCount(2);
  await expect(groupItems(page, 'In corso')).toHaveCount(2);
  await expect(groupItems(page, 'In altri terminali')).toHaveCount(1);
  await expect(groupItems(page, 'In altri terminali').filter({ has: byFolder(page, outsideBusy) })).toHaveCount(1);
  await expect(groupItems(page, 'Terminate')).toHaveCount(1);
  await expect(groupItems(page, 'Terminate').filter({ has: byFolder(page, ended) })).toHaveCount(1);
  await expect(badge(item(page, ended))).toHaveText('Terminata');

  await postHook(request, askingId, { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
  await expect(groupItems(page, 'Richiedono input')).toHaveCount(1);
  await expect(groupItems(page, 'In corso')).toHaveCount(3);

  await pointerAway(page);
  const attn = await token(page, '--attn');
  const variant = await token(page, '--on-surface-variant');
  const styles = await Promise.all(GROUPS.map((title) => styleOf(heading(page, title))));
  styles.forEach((s, i) => {
    expect(s.color, `${GROUPS[i]}: colour`).toBe(i === 0 ? attn : variant);
    expect([s.fontSize, s.lineHeight, s.fontWeight], `${GROUPS[i]}: label-l`).toEqual(['14px', '20px', '500']);
    expect([s.marginTop, s.marginRight, s.marginBottom, s.marginLeft], `${GROUPS[i]}: margins`).toEqual([i === 0 ? '8px' : '16px', '12px', '4px', '12px']);
  });
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-18, REQ-19, REQ-20, REQ-21, REQ-24, REQ-26, REQ-27, REQ-28 — scenario "The user tells working, external and ended sessions apart"
test('working, external, ended and open entries match their board variants in both themes', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const working = await newFolder('infra-terraform');
  const open = await newFolder('billing-api');
  const ended = await newFolder('docs-site');
  const outside = await newFolder('mobile-app');
  const workingId = await startViaApi(request, working);
  await startViaApi(request, open);
  const endedId = await startViaApi(request, ended);
  await postHook(request, workingId, { hook_event_name: 'UserPromptSubmit', prompt: 'esegui terraform plan su staging' });
  await stopViaApi(request, endedId);
  await runInTerminal('e2e-entries-outside', outside, 'busy');
  await page.goto('/');
  await expect(entry(page, outside)).toBeVisible(SCAN);
  await openFromList(page, open);

  await expect(headings(page)).toHaveText(['In corso', 'In altri terminali', 'Terminate']);
  await expect(groupItems(page, 'In corso').filter({ has: byFolder(page, working) })).toHaveCount(1);
  await expect(groupItems(page, 'In corso').filter({ has: byFolder(page, open) })).toHaveCount(1);
  await expect(groupItems(page, 'In altri terminali').filter({ has: byFolder(page, outside) })).toHaveCount(1);
  await expect(groupItems(page, 'Terminate').filter({ has: byFolder(page, ended) })).toHaveCount(1);

  await expect(avatar(entry(page, working))).toHaveText('IT');
  await expect(avatar(entry(page, open))).toHaveText('BA');
  await expect(avatar(entry(page, ended))).toHaveText('DS');
  await expect(avatar(entry(page, outside))).toHaveText('');
  await expect(avatar(entry(page, outside)).locator('svg')).toBeVisible();
  for (const [folder, state] of [
    [working, 'Lavora'],
    [open, 'In attesa'],
    [ended, 'Terminata'],
    [outside, 'Lavora'],
  ] as const) {
    await expect(badge(entry(page, folder)), folder).toHaveText(state);
    await expect(entry(page, folder).locator('time'), folder).toHaveText(/^(ora|\d+ min fa)$/);
  }
  await expect(entry(page, outside)).not.toContainText('Esterna');

  const bar = entry(page, working).locator('.progress-bar');
  await expect(bar).toBeVisible();
  await expect(entry(page, open).locator('.progress-bar')).toHaveCount(0);
  await expect(entry(page, ended).locator('.progress-bar')).toHaveCount(0);
  await expect(entry(page, outside).locator('.progress-bar'), 'external working entry: no bar').toHaveCount(0);
  const label = await labelOf(request, workingId);
  const [labelBox, barBox] = [await entry(page, working).getByTitle(label, { exact: true }).boundingBox(), await bar.boundingBox()];
  expect(barBox!.y - (labelBox!.y + labelBox!.height), 'bar 6 px under the label').toBeCloseTo(6, 0);
  const indicator = bar.locator('*').first();
  const moves = await indicator.evaluate(async (el) => {
    const x0 = el.getBoundingClientRect().left;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { running: el.getAnimations().some((a) => a.playState === 'running'), moved: el.getBoundingClientRect().left !== x0 };
  });
  expect(moves, 'the indicator slides').toEqual({ running: true, moved: true });

  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = async (name: string) => token(page, name);

    for (const [folder, name] of [
      [working, 'working'],
      [open, 'open'],
      [ended, 'ended'],
      [outside, 'external'],
    ] as const) {
      await expectBoardRow(entry(page, folder), `${scheme} ${name}`);
      await expectBoardText(page, entry(page, folder), folder, `${scheme} ${name}`);
    }

    const w = await styleOf(entry(page, working));
    expect(transparent(w.backgroundColor), `${scheme} working: transparent`).toBe(true);
    expect(w.color, `${scheme} working: text`).toBe(await t('--on-surface'));
    expect(hasNoBorder(w), `${scheme} working: no border`).toBe(true);
    expect((await styleOf(entry(page, working).getByTitle(label, { exact: true }))).color, `${scheme} working: label`).toBe(await t('--on-surface-variant'));
    expect((await styleOf(badge(entry(page, working)))).color, `${scheme} Lavora`).toBe(await t('--primary'));
    const workingAvatar = await styleOf(avatar(entry(page, working)));
    const variants = [
      { background: await t('--primary-container'), color: await t('--on-primary-container'), radius: '20px' },
      { background: await t('--teal-container'), color: await t('--on-teal-container'), radius: '12px' },
    ];
    expect(variants, `${scheme} working: primary round or teal square avatar`).toContainEqual({
      background: workingAvatar.backgroundColor,
      color: workingAvatar.color,
      radius: workingAvatar.borderRadius,
    });
    const track = await styleOf(bar);
    expect([track.height, track.borderRadius, track.backgroundColor], `${scheme} bar track`).toEqual(['4px', '2px', await t('--primary-container')]);
    const ind = await styleOf(indicator);
    expect([ind.height, ind.borderRadius, ind.backgroundColor], `${scheme} bar indicator`).toEqual(['4px', '2px', await t('--primary')]);
    expect(parseFloat(ind.width) / parseFloat(track.width), `${scheme} indicator 45 %`).toBeCloseTo(0.45, 2);

    const o = await styleOf(entry(page, open));
    expect([o.backgroundColor, o.color], `${scheme} open: highlighted`).toEqual([await t('--secondary-container'), await t('--on-secondary-container')]);
    expect((await styleOf(entry(page, open).getByTitle('billing-api', { exact: true }))).color, `${scheme} open: label in the text colour`).toBe(o.color);
    expect((await styleOf(badge(entry(page, open)))).color, `${scheme} In attesa`).toBe(o.color);

    const e = await styleOf(entry(page, ended));
    expect(transparent(e.backgroundColor), `${scheme} ended: transparent`).toBe(true);
    expect(e.color, `${scheme} ended: dimmed text`).toBe(await t('--on-surface-variant'));
    expect((await styleOf(entry(page, ended).getByTitle('docs-site', { exact: true }))).color, `${scheme} ended: label in the text colour`).toBe(e.color);
    expect((await styleOf(badge(entry(page, ended)))).color, `${scheme} Terminata`).toBe(e.color);
    const endedAvatar = await styleOf(avatar(entry(page, ended)));
    expect([endedAvatar.backgroundColor, endedAvatar.color, endedAvatar.borderRadius], `${scheme} ended avatar`).toEqual([
      await t('--sc-highest'),
      await t('--on-surface-variant'),
      '20px',
    ]);

    const x = await styleOf(entry(page, outside));
    expect(transparent(x.backgroundColor), `${scheme} external: transparent`).toBe(true);
    expect(x.color, `${scheme} external: text`).toBe(await t('--on-surface'));
    expect(borderOf(x), `${scheme} external: dashed border`).toEqual({ width: '1px', style: 'dashed', colour: await t('--outline-variant') });
    const outsideAvatar = await styleOf(avatar(entry(page, outside)));
    expect(transparent(outsideAvatar.backgroundColor), `${scheme} external avatar: transparent`).toBe(true);
    expect([borderOf(outsideAvatar), isCircle(outsideAvatar.borderRadius, 40), outsideAvatar.color], `${scheme} external avatar: outlined circle`).toEqual([
      { width: '1px', style: 'solid', colour: await t('--outline') },
      true,
      await t('--on-surface-variant'),
    ]);
    const icon = await avatar(entry(page, outside)).locator('svg').boundingBox();
    expect([icon?.width, icon?.height], `${scheme} external avatar: 20 px terminal icon`).toEqual([20, 20]);
  }

  const avatarClass = (await avatar(entry(page, working)).getAttribute('class')) ?? '';
  await page.reload();
  await expect(avatar(entry(page, working)), 'same avatar variant after a reload').toHaveClass(avatarClass);
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17, REQ-25 — scenario "The user sees an external session that waits for input"
test('an external session that waits for input is the amber row with "Esterna" under "Richiedono input", with no "Rispondi"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const outside = await newFolder('mobile-app');
  await runInTerminal('e2e-entries-waiting', outside, 'waiting');
  await page.goto('/');
  await expect(entry(page, outside)).toBeVisible(SCAN);

  await expect(headings(page)).toHaveText(['Richiedono input']);
  const row = entry(page, outside);
  await expect(groupItems(page, 'Richiedono input').filter({ has: byFolder(page, outside) })).toHaveCount(1);
  await expect(card(page, outside)).toHaveCount(0);
  await expect(item(page, outside).getByRole('button', { name: 'Rispondi' })).toHaveCount(0);
  await expect(item(page, outside).getByRole('button')).toHaveCount(1);
  await expect(badge(row)).toHaveText('Richiede input');
  await expect(counter(page)).toHaveText('1 richiede input');

  const tag = row.locator('.label-m', { hasText: 'Esterna' }).filter({ hasNotText: 'Richiede' });
  await expect(tag).toHaveText('Esterna');
  await expect(tag.locator('svg')).toBeVisible();
  const [titleBox, tagBox] = [await row.getByTitle(outside, { exact: true }).boundingBox(), await tag.boundingBox()];
  expect(tagBox!.x, '"Esterna" after the folder name').toBeGreaterThanOrEqual(titleBox!.x + titleBox!.width - 0.5);

  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = async (name: string) => token(page, name);
    await expectBoardRow(row, `${scheme} external needs input`, '20px');
    await expectBoardText(page, row, outside, `${scheme} external needs input`);
    const s = await styleOf(row);
    expect([s.backgroundColor, s.color], `${scheme}: amber row`).toEqual([await t('--attn-container'), await t('--on-attn-container')]);
    expect(hasNoBorder(s), `${scheme}: no dashed border`).toBe(true);
    expect(Number((await styleOf(badge(row))).fontWeight), `${scheme}: bold state`).toBeGreaterThanOrEqual(700);
    const a = await styleOf(avatar(row));
    expect([borderOf(a), isCircle(a.borderRadius, 40)], `${scheme}: outlined avatar`).toEqual([{ width: '1px', style: 'solid', colour: await t('--outline') }, true]);
    const tagStyle = await styleOf(tag);
    expect(
      {
        height: tagStyle.height,
        padding: [tagStyle.paddingLeft, tagStyle.paddingRight],
        radius: tagStyle.borderRadius,
        border: borderOf(tagStyle),
        color: tagStyle.color,
        font: [tagStyle.fontSize, tagStyle.fontWeight],
      },
      `${scheme}: "Esterna" tag`,
    ).toEqual({
      height: '20px',
      padding: ['6px', '6px'],
      radius: '6px',
      border: { width: '1px', style: 'solid', colour: await t('--outline') },
      color: await t('--on-surface-variant'),
      font: ['12px', '500'],
    });
    const tagIcon = await tag.locator('svg').boundingBox();
    expect([tagIcon?.width, tagIcon?.height], `${scheme}: 12 px terminal icon`).toEqual([12, 12]);
  }

  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'true');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22, REQ-26, REQ-28: the hosted needs-input card of board "Sessione ospitata", in both themes, with the primary ring when open
test('the hosted needs-input card matches the board in both themes and gets the primary ring when open', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const asks = await newFolder('web-dashboard');
  const asksId = await startViaApi(request, asks);
  await page.goto('/');
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  const webCard = card(page, asks);
  await expect(webCard).toBeVisible();
  const reply = webCard.getByRole('button', { name: 'Rispondi', exact: true });

  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = async (name: string) => token(page, name);
    const c = await styleOf(webCard);
    expect(
      { background: c.backgroundColor, color: c.color, radius: c.borderRadius, padding: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft] },
      `${scheme}: card`,
    ).toEqual({ background: await t('--attn-container'), color: await t('--on-attn-container'), radius: '20px', padding: ['14px', '16px', '14px', '16px'] });
    expect(hasRing(c, await t('--primary')), `${scheme}: no ring while not open`).toBe(false);
    const a = await styleOf(avatar(webCard));
    expect([a.backgroundColor, a.color, a.borderRadius, a.width, a.height], `${scheme}: amber square avatar`).toEqual([
      await t('--attn'),
      await t('--sc-lowest'),
      '12px',
      '40px',
      '40px',
    ]);
    const b = await styleOf(badge(webCard));
    expect([b.color, Number(b.fontWeight) >= 700], `${scheme}: bold state in the card colour`).toEqual([c.color, true]);
    const r = await styleOf(reply);
    expect(
      { height: r.height, padding: [r.paddingLeft, r.paddingRight], background: r.backgroundColor, color: r.color, font: [r.fontSize, r.fontWeight] },
      `${scheme}: "Rispondi"`,
    ).toEqual({ height: '32px', padding: ['14px', '14px'], background: await t('--attn'), color: await t('--sc-lowest'), font: ['14px', '500'] });
    const line = await styleOf(webCard.getByText('Permesso per'));
    expect([line.fontSize, line.lineHeight], `${scheme}: body-s line`).toEqual(['12px', '16px']);
  }

  await reply.click();
  await expect(entry(page, asks)).toHaveAttribute('aria-current', 'true');
  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const c = await styleOf(webCard);
    expect(hasRing(c, await token(page, '--primary')), `${scheme}: 2 px primary ring when open`).toBe(true);
    expect(c.backgroundColor, `${scheme}: still amber when open`).toBe(await token(page, '--attn-container'));
  }
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19; RelativeTime: the time text refreshes every 30 s with no new data
test('the time of the last activity reads "ora", then "1 min fa" a minute later with no new data', async ({ page, request }) => {
  await page.clock.install();
  await showOnlyOwnSessions(page);
  const folder = await newFolder('time-refresh');
  await startViaApi(request, folder);
  await page.goto('/');
  const time = entry(page, folder).locator('time');
  await expect(time).toHaveText('ora');
  await page.clock.fastForward('01:05');
  await expect(time).toHaveText('1 min fa');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-21; ProgressBar: with reduced motion the indicator stays still at the start of the track
test('with reduced motion the progress indicator stays still at the start of the track', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('still-bar');
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Lavora' });
  await page.goto('/');
  const bar = entry(page, folder).locator('.progress-bar');
  await expect(bar).toBeVisible();
  const still = await bar.evaluate(async (track) => {
    const indicator = track.firstElementChild!;
    const first = indicator.getBoundingClientRect().left;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { atStart: Math.abs(first - track.getBoundingClientRect().left) <= 0.5, still: indicator.getBoundingClientRect().left === first };
  });
  expect(still).toEqual({ atStart: true, still: true });
});

// SessionList "Entry row": a long folder name and a long label are cut on one line with an ellipsis and keep the full value as tooltip
test('a long folder name and a long label are cut on one line with an ellipsis, with the full path and label as tooltip', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const short = await newFolder('short');
  const longName = `progetto-con-un-nome-davvero-molto-lungo-${'per-la-barra-laterale-'.repeat(6)}fine`;
  const long = await newFolder(longName);
  await startViaApi(request, short);
  const longId = await startViaApi(request, long);
  await postHook(request, longId, {
    hook_event_name: 'UserPromptSubmit',
    prompt: `Riscrivi il modulo di autenticazione ${'e aggiorna la documentazione '.repeat(4)}`,
  });
  await postHook(request, longId, { hook_event_name: 'Stop' });
  await page.goto('/');
  await expect(entry(page, long)).toBeVisible();
  await expect(badge(entry(page, long))).toHaveText('In attesa');
  const longLabel = await labelOf(request, longId);
  expect(longLabel.length, 'fixture label is long').toBeGreaterThan(60);

  for (const [tooltip, text] of [
    [long, longName],
    [longLabel, longLabel],
  ] as const) {
    const cut = await entry(page, long)
      .getByTitle(tooltip, { exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { text: el.textContent, whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, overflowing: el.scrollWidth > el.clientWidth };
      });
    expect(cut.text, 'shown value').toBe(text);
    expect(cut.textOverflow, 'ellipsis').toBe('ellipsis');
    expect(cut.whiteSpace, 'one line').toBe('nowrap');
    expect(cut.overflowing, 'the value is cut').toBe(true);
  }

  const row = await entry(page, long).boundingBox();
  for (const part of [badge(entry(page, long)), entry(page, long).locator('time')]) {
    const box = await part.boundingBox();
    expect(box!.x + box!.width, 'inside the entry').toBeLessThanOrEqual(row!.x + row!.width + 0.5);
  }
  const shortRow = await entry(page, short).boundingBox();
  expect(row!.height, 'no text wraps: same height as a short entry').toBeCloseTo(shortRow!.height, 0);
});

// plan-claude_sessions_client-ui_redesign/REQ-14, plan-claude_sessions_client-ui_redesign-material3_mock/REQ-11; NeedsInputCounter: hidden at 0, amber chip with its icon above 0
test('the counter is hidden at 0, shows the amber chip with its icon above 0, and stays visible whatever the main area shows', async ({
  page,
  request,
}) => {
  await showOnlyOwnSessions(page);
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'GET');
  await page.goto('/');
  await loaded;
  await expect(list(page).getByRole('status').filter({ hasText: 'Caricamento' })).toHaveCount(0);
  await expect(counter(page)).toHaveCount(0);
  await expect(list(page).getByRole('status').locator('svg')).toHaveCount(0);

  const folder = await newFolder('counter');
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(counter(page)).toHaveText('1 richiede input');
  const chip = counter(page).locator('.chip');
  const icon = chip.locator('svg.icon');
  await expect(icon).toBeVisible();
  const iconBeforeText = await chip.evaluate((el) => {
    const svg = el.querySelector('svg')!.getBoundingClientRect();
    const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /richiede input/.test(n.textContent ?? ''));
    const range = document.createRange();
    range.selectNodeContents(text!);
    return svg.right <= range.getBoundingClientRect().left + 0.5;
  });
  expect(iconBeforeText, 'icon before the text').toBe(true);
  const style = await chip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor };
  });
  expect(style.background).toBe(await token(page, '--attn-container'));
  expect(style.color).toBe(await token(page, '--on-attn-container'));

  await rail(page).getByRole('button', { name: 'Nuova sessione', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Scegli la cartella del progetto' })).toBeVisible();
  await expect(counter(page), 'visible with the folder chooser').toBeInViewport();
  await page.getByRole('button', { name: 'Annulla' }).click();
  await rail(page).getByRole('button', { name: 'Riprendi', exact: true }).click();
  const resume = page.getByRole('dialog', { name: 'Riprendi sessione' });
  await expect(resume).toBeVisible();
  await expect(counter(page), 'visible with the resume dialog').toBeInViewport();
  await resume.getByRole('button', { name: 'Annulla', exact: true }).click();

  await openFromList(page, folder);
  await expect(counter(page), 'visible with an open session').toBeInViewport();
  await expect(counter(page)).toHaveText('1 richiede input');
});
