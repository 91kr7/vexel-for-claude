// e2e of plan-claude_sessions_client-ui_redesign-material3_mock, batch session-list, brought to the Studio rows of plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark.
// The server runs the fake CLI (playwright.config.ts).
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
const GROUPS = ['Needs Input', 'Running', 'In Other Terminals', 'Ended'];

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

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const mainArea = (page: Page) => page.getByRole('main');
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
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
const counter = (page: Page) => list(page).getByRole('status').filter({ hasText: /needs? input/ });
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

const transparent = (colour: string) => colour === 'transparent' || /^rgba\(.*,\s*0\)$/.test(colour);
const MONO = /^["']?Roboto Mono["']?/;
/** The decorative status dot of a row: its first aria-hidden element. */
const dot = (row: Locator) => row.locator('[aria-hidden="true"]').first();

/** Row geometry of `.vx-session-row` (SessionList "Entry row"): padding 6 × 8 px (5 × 7 px inside the dashed border), 6 px radius, 8 px dot, no avatar. */
async function expectStudioRow(row: Locator, name: string, external = false): Promise<void> {
  const s = await styleOf(row);
  const pad = external ? ['5px', '7px', '5px', '7px'] : ['6px', '8px', '6px', '8px'];
  if (s.borderLeftWidth === '0px' || s.borderLeftStyle === 'none' || external) {
    expect([s.paddingTop, s.paddingRight, s.paddingBottom], `${name}: padding`).toEqual(pad.slice(0, 3));
  }
  expect(s.borderRadius, `${name}: radius`).toBe('6px');
  await expect(avatar(row), `${name}: no avatar`).toHaveCount(0);
  const box = await dot(row).boundingBox();
  expect([box?.width, box?.height], `${name}: 8 px dot`).toEqual([8, 8]);
}

/** Text styles of a row: 12 px folder name, mono 10 px state in its colour, mono 10 px muted time. */
async function expectStudioText(page: Page, row: Locator, folder: string, name: string, stateColour: string): Promise<void> {
  const title = await styleOf(row.getByTitle(folder, { exact: true }));
  expect(title.fontSize, `${name}: 12 px folder name`).toBe('12px');
  const state = await styleOf(badge(row));
  expect([state.fontSize, state.color], `${name}: mono 10 px state`).toEqual(['10px', stateColour]);
  expect(await badge(row).evaluate((el) => getComputedStyle(el).fontFamily), `${name}: mono state`).toMatch(MONO);
  const time = row.locator('time');
  if ((await time.count()) > 0) {
    const t = await styleOf(time);
    expect([t.fontSize, t.color], `${name}: mono 10 px muted time`).toEqual(['10px', await token(page, '--text-muted')]);
    expect(await time.evaluate((el) => getComputedStyle(el).fontFamily), `${name}: mono time`).toMatch(MONO);
  }
}

const borderOf = (s: Style) => ({ width: s.borderTopWidth, style: s.borderTopStyle, colour: s.borderTopColor });

/** Whether the element draws a 2 px bar of `colour` at its left edge: border, inset shadow or ::before. */
const hasLeftBar = (target: Locator, colour: string) =>
  target.evaluate((el, c) => {
    const near2 = (v: string) => Math.abs(parseFloat(v) - 2) <= 0.6;
    const s = getComputedStyle(el);
    if (near2(s.borderLeftWidth) && s.borderLeftColor === c && s.borderLeftStyle !== 'none') return true;
    if (s.boxShadow.includes(c) && /inset/.test(s.boxShadow)) return true;
    for (const pseudo of ['::before', '::after']) {
      const p = getComputedStyle(el, pseudo);
      if (p.content !== 'none' && near2(p.width) && p.backgroundColor === c) return true;
    }
    return false;
  }, colour);

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, REQ-17, REQ-22, REQ-23, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-28 — scenario "The user answers a waiting session from its card"
test('the user answers a waiting session from its amber card with "Reply"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const web = await newFolder('web-dashboard');
  const billing = await newFolder('billing-api');
  const webId = await startViaApi(request, web);
  await startViaApi(request, billing);
  await page.goto('/');
  await openFromList(page, billing);
  await postHook(request, webId, { hook_event_name: 'UserPromptSubmit', prompt: 'rimuovi le dipendenze inutilizzate' });
  await postHook(request, webId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

  await expect(headings(page)).toHaveText(['Needs Input', 'Running']);
  await expect(groupItems(page, 'Needs Input')).toHaveCount(1);
  await expect(groupItems(page, 'Needs Input').locator('.session-card').filter({ has: byFolder(page, web) })).toBeVisible();
  await expect(groupItems(page, 'Running').filter({ has: byFolder(page, billing) })).toHaveCount(1);

  const webCard = card(page, web);
  await expect(avatar(webCard)).toHaveCount(0);
  await expect(entry(page, web)).toContainText('web-dashboard');
  await expect(entry(page, web)).toContainText('rimuovi le dipendenze inutilizzate');
  await expect(webCard.getByText('Needs Input', { exact: true })).toBeVisible();
  await expect(entry(page, web)).toHaveAccessibleDescription('Permission for Bash · Just now');
  const toolWeight = Number((await styleOf(webCard.getByText('Bash', { exact: true }))).fontWeight);
  const lineWeight = Number((await styleOf(webCard.getByText(/^Permission for/))).fontWeight);
  expect(toolWeight, 'tool name in bold').toBeGreaterThan(lineWeight);
  await expect(terminal(page)).toContainText(`CWD:${billing}`);

  await webCard.getByRole('button', { name: 'Reply', exact: true }).click();
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

  const line = await card(page, asks).getByText('Permission for').boundingBox();
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

  await expect(entry(page, prompted)).toHaveAccessibleDescription('Permission for Edit · Just now');
  await expect(entry(page, elicited)).toHaveAccessibleDescription('Scegli il database · Just now');
  await expect(card(page, elicited)).not.toContainText('Permission for');

  await postHook(request, promptedId, { hook_event_name: 'PostToolUse', tool_name: 'Edit' });
  await expect(card(page, prompted)).toHaveCount(0);
  await expect(groupItems(page, 'Running').filter({ has: byFolder(page, prompted) })).toHaveCount(1);
  await expect(item(page, prompted)).not.toContainText('Permission for');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-16, REQ-17, REQ-18 and plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order/REQ-1, REQ-2
test('sessions sit in their groups, in order, keep their place, and an empty group is hidden', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const older = await newFolder('grp-older');
  const newer = await newFolder('grp-newer');
  const asking = await newFolder('grp-asking');
  const ended = await newFolder('grp-ended');
  const outsideBusy = await newFolder('grp-outside-busy');
  const outsideWaiting = await newFolder('grp-outside-waiting');
  const olderId = await startViaApi(request, older);
  await page.goto('/');
  await expect(headings(page)).toHaveText(['Running']);

  const newerId = await startViaApi(request, newer);
  await postHook(request, newerId, { hook_event_name: 'UserPromptSubmit', prompt: 'Running' });
  await expect(groupItems(page, 'Running')).toHaveCount(2);
  await expect(groupItems(page, 'Running').last()).toContainText('grp-newer');
  await postHook(request, olderId, { hook_event_name: 'UserPromptSubmit', prompt: 'Resume' });
  await expect(badge(item(page, older))).toHaveText('Running');
  await expect(groupItems(page, 'Running').first()).toContainText('grp-older');

  const askingId = await startViaApi(request, asking);
  await postHook(request, askingId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await stopViaApi(request, await startViaApi(request, ended));
  await runInTerminal('e2e-groups-busy', outsideBusy, 'busy');
  await runInTerminal('e2e-groups-waiting', outsideWaiting, 'waiting');

  await expect(headings(page)).toHaveText(GROUPS, SCAN);
  await expect(groupItems(page, 'Needs Input').filter({ has: byFolder(page, asking) })).toHaveCount(1);
  await expect(groupItems(page, 'Needs Input').filter({ has: byFolder(page, outsideWaiting) })).toHaveCount(1);
  await expect(groupItems(page, 'Needs Input')).toHaveCount(2);
  await expect(groupItems(page, 'Running')).toHaveCount(2);
  await expect(groupItems(page, 'In Other Terminals')).toHaveCount(1);
  await expect(groupItems(page, 'In Other Terminals').filter({ has: byFolder(page, outsideBusy) })).toHaveCount(1);
  await expect(groupItems(page, 'Ended')).toHaveCount(1);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended) })).toHaveCount(1);
  await expect(badge(item(page, ended))).toHaveText('Ended');

  await postHook(request, askingId, { hook_event_name: 'PostToolUse', tool_name: 'Bash' });
  await expect(groupItems(page, 'Needs Input')).toHaveCount(1);
  await expect(groupItems(page, 'Running')).toHaveCount(3);

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-12: every group title is the mono uppercase muted label
  await pointerAway(page);
  const muted = await token(page, '--text-muted');
  for (const title of GROUPS) {
    const s = await styleOf(heading(page, title));
    expect([s.color, s.fontSize], `${title}: muted 10 px`).toEqual([muted, '10px']);
    expect(await heading(page, title).evaluate((el) => [getComputedStyle(el).textTransform, getComputedStyle(el).fontFamily])).toEqual([
      'uppercase',
      expect.stringMatching(MONO),
    ]);
  }
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-8, REQ-9, REQ-23 to REQ-27, REQ-29 — scenario "The list shows each session as a compact Studio row"
test('working, external, ended and open entries have their Studio row variants whatever the system theme', async ({ page, request }) => {
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

  await expect(headings(page)).toHaveText(['Running', 'In Other Terminals', 'Ended']);
  await expect(groupItems(page, 'Running').filter({ has: byFolder(page, working) })).toHaveCount(1);
  await expect(groupItems(page, 'Running').filter({ has: byFolder(page, open) })).toHaveCount(1);
  await expect(groupItems(page, 'In Other Terminals').filter({ has: byFolder(page, outside) })).toHaveCount(1);
  await expect(groupItems(page, 'Ended').filter({ has: byFolder(page, ended) })).toHaveCount(1);

  for (const [folder, state] of [
    [working, 'Running'],
    [open, 'Idle'],
    [ended, 'Ended'],
    [outside, 'Running'],
  ] as const) {
    await expect(badge(entry(page, folder)), folder).toHaveText(state);
    await expect(entry(page, folder).locator('time'), folder).toHaveText(/^(Just now|\d+m ago)$/);
  }
  await expect(entry(page, outside)).not.toContainText('External');

  const bar = entry(page, working).locator('.progress-bar');
  await expect(bar).toBeVisible();
  await expect(entry(page, open).locator('.progress-bar')).toHaveCount(0);
  await expect(entry(page, ended).locator('.progress-bar')).toHaveCount(0);
  await expect(entry(page, outside).locator('.progress-bar'), 'external working entry: no bar').toHaveCount(0);
  const label = await labelOf(request, workingId);
  const line2 = entry(page, working).getByTitle(label, { exact: true }).locator('xpath=..');
  const [lineBox, barBox] = [await line2.boundingBox(), await bar.boundingBox()];
  expect.soft(barBox!.y - (lineBox!.y + lineBox!.height), 'bar 2 px under line 2').toBeCloseTo(2, 0);
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
    const emerald400 = 'rgb(52, 211, 153)';
    const zinc400 = 'rgb(161, 161, 170)';

    await expectStudioRow(entry(page, working), `${scheme} working`);
    await expectStudioText(page, entry(page, working), working, `${scheme} working`, emerald400);
    await expectStudioRow(entry(page, ended), `${scheme} ended`);
    await expectStudioText(page, entry(page, ended), ended, `${scheme} ended`, zinc400);
    await expectStudioRow(entry(page, outside), `${scheme} external`, true);
    await expectStudioText(page, entry(page, outside), outside, `${scheme} external`, emerald400);
    await expectStudioRow(entry(page, open), `${scheme} open`);

    const w = await styleOf(entry(page, working));
    expect(transparent(w.backgroundColor), `${scheme} working: transparent`).toBe(true);
    expect(w.color, `${scheme} working: text`).toBe(await t('--text-secondary'));
    expect((await styleOf(entry(page, working).getByTitle(label, { exact: true }))).color, `${scheme} working: label`).toBe(await t('--text-muted'));
    expect((await styleOf(dot(entry(page, working)))).backgroundColor, `${scheme} working: emerald dot`).toBe(emerald400);
    expect(await dot(entry(page, working)).evaluate((el) => getComputedStyle(el).animationName), `${scheme} working: pulsing dot`).not.toBe('none');
    const track = await styleOf(bar);
    expect([track.height, track.borderRadius, track.backgroundColor], `${scheme} bar track`).toEqual(['4px', '2px', 'rgba(16, 185, 129, 0.15)']);
    const ind = await styleOf(indicator);
    expect([ind.height, ind.borderRadius, ind.backgroundColor], `${scheme} bar indicator`).toEqual(['4px', '2px', emerald400]);
    expect(parseFloat(ind.width) / parseFloat(track.width), `${scheme} indicator 45 %`).toBeCloseTo(0.45, 2);

    const o = await styleOf(entry(page, open));
    expect([o.backgroundColor, o.color, o.fontWeight], `${scheme} open: accent glow`).toEqual([await t('--accent-glow'), await t('--text-primary'), '600']);
    expect(await hasLeftBar(entry(page, open), await t('--accent-primary')), `${scheme} open: 2 px accent bar`).toBe(true);
    expect((await styleOf(entry(page, open).locator('time'))).color, `${scheme} open: time in the secondary colour`).toBe(await t('--text-secondary'));
    expect((await styleOf(dot(entry(page, open)))).backgroundColor, `${scheme} open idle: zinc dot`).toBe(zinc400);
    expect(await dot(entry(page, open)).evaluate((el) => getComputedStyle(el).animationName), `${scheme} idle: no pulse`).toBe('none');

    const e = await styleOf(entry(page, ended));
    expect(transparent(e.backgroundColor), `${scheme} ended: transparent`).toBe(true);
    expect(e.color, `${scheme} ended: dimmed text`).toBe(await t('--text-muted'));
    expect((await styleOf(dot(entry(page, ended)))).backgroundColor, `${scheme} ended: zinc dot`).toBe(zinc400);

    const x = await styleOf(entry(page, outside));
    expect(transparent(x.backgroundColor), `${scheme} external: transparent`).toBe(true);
    expect(borderOf(x), `${scheme} external: dashed border`).toEqual({ width: '1px', style: 'dashed', colour: await t('--border-strong') });
  }

  // the ended row stays dimmed under the pointer
  await entry(page, ended).hover();
  await expect.poll(async () => (await styleOf(entry(page, ended))).color).toBe(await token(page, '--text-muted'));
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17, REQ-25 — scenario "The user sees an external session that waits for input"
test('an external session that waits for input is the amber row with "External" under "Needs Input", with no "Reply"', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const outside = await newFolder('mobile-app');
  await runInTerminal('e2e-entries-waiting', outside, 'waiting');
  await page.goto('/');
  await expect(entry(page, outside)).toBeVisible(SCAN);

  await expect(headings(page)).toHaveText(['Needs Input']);
  const row = entry(page, outside);
  await expect(groupItems(page, 'Needs Input').filter({ has: byFolder(page, outside) })).toHaveCount(1);
  await expect(card(page, outside)).toHaveCount(0);
  await expect(item(page, outside).getByRole('button', { name: 'Reply' })).toHaveCount(0);
  // plan-session_list_improvements/REQ-25, plan-favorite_session/REQ-2: the entry button, "Mark as Favorite" and "Rename"
  await expect(item(page, outside).getByRole('button')).toHaveCount(3);
  await expect(item(page, outside).getByRole('button', { name: 'Mark as Favorite', exact: true })).toHaveCount(1);
  await expect(item(page, outside).getByRole('button', { name: 'Rename', exact: true })).toHaveCount(1);
  await expect(badge(row)).toHaveText('Needs Input');
  await expect(counter(page)).toHaveText('1 needs input');

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-27: the "External" mono chip after the folder name, the dashed row, the amber dot
  const tag = row.getByText('External', { exact: true });
  await expect(tag).toHaveText('External');
  const [titleBox, tagBox] = [await row.getByTitle(outside, { exact: true }).boundingBox(), await tag.boundingBox()];
  expect(tagBox!.x, '"External" after the folder name').toBeGreaterThanOrEqual(titleBox!.x + titleBox!.width - 0.5);

  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = async (name: string) => token(page, name);
    await expectStudioRow(row, `${scheme} external needs input`, true);
    await expectStudioText(page, row, outside, `${scheme} external needs input`, 'rgb(251, 191, 36)');
    const s = await styleOf(row);
    expect(borderOf(s), `${scheme}: dashed border`).toEqual({ width: '1px', style: 'dashed', colour: await t('--border-strong') });
    expect((await styleOf(dot(row))).backgroundColor, `${scheme}: amber dot`).toBe('rgb(251, 191, 36)');
    expect(await dot(row).evaluate((el) => getComputedStyle(el).animationName), `${scheme}: pulsing dot`).not.toBe('none');
    const tagStyle = await styleOf(tag);
    expect({ radius: tagStyle.borderRadius, background: tagStyle.backgroundColor, color: tagStyle.color, size: tagStyle.fontSize }, `${scheme}: "External" chip`).toEqual({
      radius: '4px',
      background: await t('--bg-surface-2'),
      color: await t('--text-secondary'),
      size: '10px',
    });
    expect(await tag.evaluate((el) => getComputedStyle(el).fontFamily), `${scheme}: mono chip`).toMatch(MONO);
  }

    await row.click();
  await expect(row).toHaveAttribute('aria-current', 'true');
});

// plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-24, REQ-28: the hosted needs-input card in the permission-banner look, with the accent bar when open
test('the hosted needs-input card has the permission-banner look whatever the system theme, and the accent glow and bar when open', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const asks = await newFolder('web-dashboard');
  const asksId = await startViaApi(request, asks);
  await page.goto('/');
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  const webCard = card(page, asks);
  await expect(webCard).toBeVisible();
  const reply = webCard.getByRole('button', { name: 'Reply', exact: true });

  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = async (name: string) => token(page, name);
    const c = await styleOf(webCard);
    expect(
      { background: c.backgroundColor, border: borderOf(c), radius: c.borderRadius, padding: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft] },
      `${scheme}: card`,
    ).toEqual({
      background: await t('--bg-surface-2'),
      border: { width: '1px', style: 'solid', colour: 'rgba(245, 158, 11, 0.4)' },
      radius: '12px',
      padding: ['14px', '14px', '14px', '14px'],
    });
    await expect(avatar(webCard)).toHaveCount(0);
    const tag = await styleOf(webCard.getByText('Needs Input', { exact: true }));
    expect({ color: tag.color, background: tag.backgroundColor, size: tag.fontSize, radius: tag.borderRadius }, `${scheme}: amber tag`).toEqual({
      color: 'rgb(252, 211, 77)',
      background: 'rgba(245, 158, 11, 0.2)',
      size: '10px',
      radius: '4px',
    });
    const r = await styleOf(reply);
    expect({ background: r.backgroundColor, color: r.color, padding: [r.paddingLeft, r.paddingRight] }, `${scheme}: accent "Reply"`).toEqual({
      background: await t('--accent-primary'),
      color: await t('--bg-canvas'),
      padding: ['14px', '14px'],
    });
    const line = webCard.getByText(/^Permission for/);
    const l = await styleOf(line);
    expect({ size: l.fontSize, color: l.color, background: l.backgroundColor }, `${scheme}: #perm-cmd line`).toEqual({
      size: '12px',
      color: 'rgb(252, 211, 77)',
      background: await t('--bg-canvas'),
    });
    expect(await line.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(MONO);
  }

  await reply.click();
  await expect(entry(page, asks)).toHaveAttribute('aria-current', 'true');
  await pointerAway(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const accent = await token(page, '--accent-primary');
    const barred = (await hasLeftBar(webCard, accent)) || (await hasLeftBar(entry(page, asks), accent));
    expect(barred, `${scheme}: 2 px accent bar when open`).toBe(true);
    expect((await styleOf(webCard)).borderTopColor, `${scheme}: still amber when open`).toBe('rgba(245, 158, 11, 0.4)');
  }
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19; RelativeTime: the time text refreshes every 30 s with no new data
test('the time of the last activity reads "Just now", then "1m ago" a minute later with no new data', async ({ page, request }) => {
  await page.clock.install();
  await showOnlyOwnSessions(page);
  const folder = await newFolder('time-refresh');
  await startViaApi(request, folder);
  await page.goto('/');
  const time = entry(page, folder).locator('time');
  await expect(time).toHaveText('Just now');
  await page.clock.fastForward('01:05');
  await expect(time).toHaveText('1m ago');
});

// plan-claude_sessions_client-ui_redesign-material3_mock/REQ-21; ProgressBar: with reduced motion the indicator stays still at the start of the track
test('with reduced motion the progress indicator stays still at the start of the track', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await showOnlyOwnSessions(page);
  const folder = await newFolder('still-bar');
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'UserPromptSubmit', prompt: 'Running' });
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
  await expect(badge(entry(page, long))).toHaveText('Idle');
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

// plan-claude_sessions_client-ui_redesign/REQ-14, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-21; NeedsInputCounter: hidden at 0, amber pill with its dot above 0
test('the counter is hidden at 0, shows the amber pill with its dot above 0, and stays visible whatever the main area shows', async ({
  page,
  request,
}) => {
  await showOnlyOwnSessions(page);
  const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/sessions' && r.request().method() === 'GET');
  await page.goto('/');
  await loaded;
  await expect(list(page).getByRole('status').filter({ hasText: 'Loading' })).toHaveCount(0);
  await expect(counter(page)).toHaveCount(0);
  await expect(list(page).getByRole('status').locator('svg')).toHaveCount(0);

  const folder = await newFolder('counter');
  const id = await startViaApi(request, folder);
  await postHook(request, id, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(counter(page)).toHaveText('1 needs input');
  const chip = counter(page).locator(':scope > *').first();
  const pillDot = chip.locator('[aria-hidden="true"]').first();
  await expect(pillDot).toBeVisible();
  const dotBeforeText = await chip.evaluate((el) => {
    const mark = el.querySelector('[aria-hidden="true"]')!.getBoundingClientRect();
    const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /needs? input/.test(n.textContent ?? ''));
    const range = document.createRange();
    range.selectNodeContents(text!);
    return mark.right <= range.getBoundingClientRect().left + 0.5;
  });
  expect(dotBeforeText, 'dot before the text').toBe(true);
  const style = await chip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor, font: s.fontFamily };
  });
  expect(style.background).toBe('rgba(245, 158, 11, 0.15)');
  expect(style.color).toBe('rgb(251, 191, 36)');
  expect(style.font).toMatch(MONO);
  expect(await pillDot.evaluate((el) => getComputedStyle(el).animationName), 'the dot pulses').not.toBe('none');

  await rail(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Choose the Project Folder' })).toBeVisible();
  await expect(counter(page), 'visible with the folder chooser').toBeInViewport();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await rail(page).getByRole('button', { name: 'Resume', exact: true }).click();
  const resume = page.getByRole('dialog', { name: 'Resume Session' });
  await expect(resume).toBeVisible();
  await expect(counter(page), 'visible with the resume dialog').toBeInViewport();
  await resume.getByRole('button', { name: 'Cancel', exact: true }).click();

  await openFromList(page, folder);
  await expect(counter(page), 'visible with an open session').toBeInViewport();
  await expect(counter(page)).toHaveText('1 needs input');
});
