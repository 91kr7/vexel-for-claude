// e2e of plan-claude_sessions_client-ui_redesign, batch session-list. The server runs the fake CLI (playwright.config.ts).
/// <reference lib="dom" />
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';

type Rect = { left: number; right: number; top: number; bottom: number };
interface Look {
  background: string;
  /** Colour of the left bar, or 'none'. */
  bar: string;
  /** Colours of the rings drawn on all four sides. */
  frame: string[];
}

const SESSIONS_DIR = path.join(E2E_CLAUDE_DIR, 'sessions');
const TOOLTIP = 'Sessione in un altro terminale: lo stato «Richiede input» non è disponibile';
const TIME = /\d{2}:\d{2}:\d{2}/;
// The external scanner reads the sessions folder every 2 seconds.
const SCAN = { timeout: 10_000 };

let projectsRoot: string;
const createdIds: string[] = [];
const terminals: { process: ChildProcess; files: string[] }[] = [];

test.beforeAll(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-entries-'));
  await mkdir(SESSIONS_DIR, { recursive: true });
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
const entries = (page: Page) => list(page).getByRole('button');
const entry = (page: Page, folder: string) => entries(page).filter({ hasText: folder });
const badge = (target: Locator) => target.locator('.state-badge');
const counter = (page: Page) => list(page).getByRole('status').filter({ hasText: 'richiede input' });
const terminal = (page: Page) => page.locator('.xterm-rows');

/** Shows in the page only the sessions of this file: other spec files start sessions on the same server at the same time. */
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

async function labelOf(request: APIRequestContext, id: string): Promise<string> {
  const sessions = (await (await request.get('/api/sessions')).json()) as { id: string; label: string }[];
  const label = sessions.find((s) => s.id === id)?.label;
  expect(label, `session ${id} is listed`).toBeDefined();
  return label!;
}

/** Simulates Claude Code in another terminal: a live process, its `sessions/<pid>.json` and the `<pid>.<hash>.key` FIFO. */
async function runInTerminal(sessionId: string, folder: string): Promise<void> {
  const process = spawn('sleep', ['300'], { stdio: 'ignore' });
  const pid = process.pid ?? 0;
  const key = path.join(SESSIONS_DIR, `${pid}.5a6b7c8d.key`);
  const file = path.join(SESSIONS_DIR, `${pid}.json`);
  terminals.push({ process, files: [key, file] });
  execFileSync('mkfifo', [key]);
  await writeFile(file, JSON.stringify({ pid, sessionId, cwd: folder, kind: 'interactive', status: 'idle', updatedAt: Date.now() }));
}

async function openFromList(page: Page, folder: string): Promise<void> {
  await entry(page, folder).click();
  await expect(terminal(page)).toContainText(`CWD:${folder}`);
  await expect(entry(page, folder)).toHaveAttribute('aria-current', 'true');
}

/** Moves the pointer off the list, so no entry shows its hover look. */
async function pointerAway(page: Page): Promise<void> {
  const main = await mainArea(page).boundingBox();
  expect(main).not.toBeNull();
  await page.mouse.move(main!.x + main!.width / 2, main!.y + main!.height - 4);
}

/** Computed value of a theme token, for one CSS property. */
async function token(page: Page, name: string, property: 'backgroundColor' | 'fontWeight' = 'backgroundColor'): Promise<string> {
  return page.evaluate(
    ([value, prop]) => {
      const probe = document.createElement('div');
      probe.style[prop] = value;
      document.body.append(probe);
      const resolved = getComputedStyle(probe)[prop];
      probe.remove();
      return resolved;
    },
    [`var(${name})`, property] as const,
  );
}

/** Background, left bar and frame of an entry, from its computed style (borders and inset box-shadows). */
async function look(target: Locator): Promise<Look> {
  return target.evaluate((el) => {
    const s = getComputedStyle(el);
    const visible = (c: string) => c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c);
    const frame: string[] = [];
    let bar = 'none';
    for (const m of s.boxShadow.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(-?[\d.]+)px\s+inset/g)) {
      const [, colour = '', x, y, , spread] = m;
      if (!visible(colour)) continue;
      if (Number(x) === 0 && Number(y) === 0 && Number(spread) > 0) frame.push(colour);
      if (Number(x) > 0 && Number(y) === 0) bar = colour;
    }
    const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => ({
      width: parseFloat(s[`border${side}Width`]),
      colour: s[`border${side}Color`],
    }));
    const [top, right, bottom, left] = sides;
    if (sides.every((x) => x.width > 0 && visible(x.colour) && x.colour === top!.colour)) frame.push(top!.colour);
    const leftStandsOut = left!.width > 0 && visible(left!.colour) && (left!.colour !== top!.colour || left!.width > Math.max(top!.width, right!.width, bottom!.width));
    if (leftStandsOut) bar = left!.colour;
    return { background: visible(s.backgroundColor) ? s.backgroundColor : 'transparent', bar, frame };
  });
}

/** Background the list shows behind its entries: the first non-transparent one among the ancestors. */
async function listBackground(page: Page): Promise<string> {
  return list(page).evaluate((nav) => {
    for (let el: Element | null = nav; el; el = el.parentElement) {
      const colour = getComputedStyle(el).backgroundColor;
      if (colour !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(colour)) return colour;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  });
}

/** Emphasis cues of an entry: its own background, a frame, a left bar. */
function cues(entryLook: Look, background: string): number {
  const ownBackground = entryLook.background !== 'transparent' && entryLook.background !== background;
  return [ownBackground, entryLook.frame.length > 0, entryLook.bar !== 'none'].filter(Boolean).length;
}

/** Boxes of the label, state, folder and time of an entry. Label and folder are found by their tooltip. */
async function parts(target: Locator, label: string, folder: string) {
  return target.evaluate(
    (el, [labelValue, folderValue]) => {
      const rect = (e: Element | null | undefined): Rect | null => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const titled = (value: string) => [...el.querySelectorAll('[title]')].find((e) => e.getAttribute('title') === value);
      const time = [...el.querySelectorAll('*')].find((e) => e.children.length === 0 && /\d{2}:\d{2}:\d{2}/.test(e.textContent ?? ''));
      return { entry: rect(el)!, label: rect(titled(labelValue)), state: rect(el.querySelector('.state-badge')), folder: rect(titled(folderValue)), time: rect(time) };
    },
    [label, folder] as const,
  );
}

type Parts = Awaited<ReturnType<typeof parts>>;
const middle = (r: Rect) => (r.top + r.bottom) / 2;

/** REQ-11 layout of one entry: label left and state right on the first line, folder left and time right on the second. */
function expectTwoLines(p: Parts, name: string): void {
  const { label, state, folder, time } = p;
  for (const [part, r] of Object.entries({ label, state, folder, time })) expect(r, `${name}: ${part} is shown`).not.toBeNull();
  expect(Math.abs(middle(label!) - middle(state!)), `${name}: label and state on one line`).toBeLessThanOrEqual(4);
  expect(Math.abs(middle(folder!) - middle(time!)), `${name}: folder and time on one line`).toBeLessThanOrEqual(4);
  expect(folder!.top, `${name}: folder line below the label line`).toBeGreaterThanOrEqual(label!.bottom - 1);
  expect(label!.right, `${name}: label left of the state`).toBeLessThanOrEqual(state!.left + 0.5);
  expect(folder!.right, `${name}: folder left of the time`).toBeLessThanOrEqual(time!.left + 0.5);
}

/** REQ-11 across entries: each part sits at the same offset from its entry's edges. */
function expectSamePlaces(all: Parts[]): void {
  const offsets = (p: Parts) => ({
    height: p.entry.bottom - p.entry.top,
    labelLeft: p.label!.left - p.entry.left,
    labelTop: p.label!.top - p.entry.top,
    stateRight: p.entry.right - p.state!.right,
    stateTop: p.state!.top - p.entry.top,
    folderLeft: p.folder!.left - p.entry.left,
    folderTop: p.folder!.top - p.entry.top,
    timeRight: p.entry.right - p.time!.right,
    timeTop: p.time!.top - p.entry.top,
  });
  const [first, ...rest] = all.map(offsets);
  for (const other of rest) {
    for (const [key, value] of Object.entries(other)) {
      expect(Math.abs(value - first![key as keyof typeof first]), `${key} is the same in every entry`).toBeLessThanOrEqual(1);
    }
  }
}

// plan-claude_sessions_client-ui_redesign/REQ-12, REQ-13, REQ-14 — scenario "The user spots the session that needs input"
test('a session that needs input shows its state and stands out more than every other entry, the open one included', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const busy = await newFolder('busy');
  const calm = await newFolder('calm');
  const asks = await newFolder('asks');
  const busyId = await startViaApi(request, busy);
  await startViaApi(request, calm);
  const asksId = await startViaApi(request, asks);
  await postHook(request, busyId, { hook_event_name: 'UserPromptSubmit', prompt: 'Analizza i log del server' });
  await page.goto('/');
  await openFromList(page, calm);

  await postHook(request, asksId, { hook_event_name: 'UserPromptSubmit', prompt: 'Elimina la cartella build' });
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });

  await expect(badge(entry(page, asks))).toHaveText('Richiede input');
  await expect(badge(entry(page, asks))).toHaveClass(/\bstate-needs_input\b/);
  await expect(badge(entry(page, asks)).locator('svg.icon')).toBeVisible();
  expect(await badge(entry(page, asks)).evaluate((el) => getComputedStyle(el).color)).toBe(await token(page, '--color-state-needs-input'));

  await pointerAway(page);
  const needsInput = await token(page, '--color-state-needs-input');
  const background = await listBackground(page);
  const asking = await look(entry(page, asks));
  const open = await look(entry(page, calm));
  const other = await look(entry(page, busy));

  expect(asking.background, 'needs-input background').toBe(await token(page, '--color-state-needs-input-bg'));
  expect(asking.frame, 'needs-input frame').toContain(needsInput);
  expect(asking.bar, 'needs-input left bar').toBe(needsInput);
  expect(open.background, 'open entry: selected background').toBe(await token(page, '--color-surface-selected'));
  expect(open.bar, 'open entry: primary left bar').toBe(await token(page, '--color-primary'));
  expect(open.frame, 'open entry: no frame').toEqual([]);
  expect(asking.background, 'needs-input background differs from the open one').not.toBe(open.background);
  expect(cues(other, background), 'a plain entry has no emphasis').toBe(0);
  expect(cues(asking, background), 'needs input has more emphasis cues than the open entry').toBeGreaterThan(cues(open, background));
  expect(cues(open, background), 'the open entry has more emphasis cues than a plain entry').toBeGreaterThan(cues(other, background));

  await expect(counter(page)).toHaveText('1 richiede input');
  await expect(counter(page)).toBeInViewport();
  await expect(terminal(page)).toContainText(`CWD:${calm}`);
  await expect(entry(page, calm)).toHaveAttribute('aria-current', 'true');
  await expect(entry(page, asks)).not.toHaveAttribute('aria-current', /.*/);
});

// plan-claude_sessions_client-ui_redesign/REQ-12: each state shows a colour, an icon and a text together
test('each state shows its own colour, its own icon and its Italian name', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const folders = { working: await newFolder('st-working'), needs_input: await newFolder('st-needs'), idle: await newFolder('st-idle'), ended: await newFolder('st-ended') };
  const working = await startViaApi(request, folders.working);
  const needs = await startViaApi(request, folders.needs_input);
  await startViaApi(request, folders.idle);
  const ended = await startViaApi(request, folders.ended);
  await postHook(request, working, { hook_event_name: 'UserPromptSubmit', prompt: 'Lavora' });
  await postHook(request, needs, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  expect((await request.post(`/api/sessions/${ended}/stop`)).ok()).toBe(true);
  await page.goto('/');

  const expected = [
    ['working', 'In lavorazione', '--color-state-working'],
    ['needs_input', 'Richiede input', '--color-state-needs-input'],
    ['idle', 'In attesa', '--color-state-idle'],
    ['ended', 'Terminata', '--color-state-ended'],
  ] as const;
  const icons: string[] = [];
  for (const [state, name, colourToken] of expected) {
    const stateBadge = badge(entry(page, folders[state]));
    await expect(stateBadge, state).toHaveText(name);
    await expect(stateBadge, state).toHaveClass(new RegExp(`\\bstate-${state}\\b`));
    const icon = stateBadge.locator('svg.icon');
    await expect(icon, state).toBeVisible();
    const colour = await token(page, colourToken);
    expect(await stateBadge.evaluate((el) => getComputedStyle(el).color), `${state} text colour`).toBe(colour);
    expect(await icon.evaluate((el) => getComputedStyle(el).color), `${state} icon colour`).toBe(colour);
    const box = { icon: await icon.boundingBox(), badge: await stateBadge.boundingBox() };
    expect(box.icon!.x, `${state}: icon before the name`).toBeLessThanOrEqual(box.badge!.x + 1);
    icons.push(await icon.evaluate((el) => el.innerHTML));
  }
  expect(new Set(icons).size, 'each state has its own icon').toBe(expected.length);
  expect(await badge(entry(page, folders.needs_input)).evaluate((el) => getComputedStyle(el).fontWeight)).toBe(
    await token(page, '--font-weight-semibold', 'fontWeight'),
  );
});

// plan-claude_sessions_client-ui_redesign/REQ-13, REQ-16; SessionList: an open entry in needs input shows both emphases
test('an open entry that needs input keeps the needs-input background and frame, with the primary left bar', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const asks = await newFolder('open-asks');
  const calm = await newFolder('open-calm');
  const asksId = await startViaApi(request, asks);
  await startViaApi(request, calm);
  await page.goto('/');
  await openFromList(page, asks);
  await postHook(request, asksId, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' });
  await expect(badge(entry(page, asks))).toHaveText('Richiede input');

  await pointerAway(page);
  const both = await look(entry(page, asks));
  expect(both.background).toBe(await token(page, '--color-state-needs-input-bg'));
  expect(both.frame).toContain(await token(page, '--color-state-needs-input'));
  expect(both.bar).toBe(await token(page, '--color-primary'));
  await expect(entries(page).and(page.locator('[aria-current="true"]'))).toHaveCount(1);
});

// plan-claude_sessions_client-ui_redesign/REQ-11, REQ-14, REQ-15, REQ-16 — scenario "The user tells the entries apart at a glance"
test('entries show their parts in the same places, only the open one is highlighted, and the external one carries "Esterna" with its icon', async ({
  page,
  request,
}) => {
  await showOnlyOwnSessions(page);
  const hosted = await newFolder('hosted');
  const other = await newFolder('second');
  const outside = await newFolder('outside');
  const hostedId = await startViaApi(request, hosted);
  const otherId = await startViaApi(request, other);
  await postHook(request, otherId, { hook_event_name: 'UserPromptSubmit', prompt: 'Aggiorna le dipendenze' });
  await runInTerminal('e2e-entries-outside', outside);
  await page.goto('/');
  await expect(entry(page, outside)).toBeVisible(SCAN);
  await openFromList(page, hosted);
  await pointerAway(page);

  const all = [
    await parts(entry(page, hosted), await labelOf(request, hostedId), hosted),
    await parts(entry(page, other), await labelOf(request, otherId), other),
    await parts(entry(page, outside), 'outside', outside),
  ];
  all.forEach((p, i) => expectTwoLines(p, ['hosted', 'other', 'outside'][i]!));
  expectSamePlaces(all);

  await expect(entries(page).and(page.locator('[aria-current="true"]'))).toHaveCount(1);
  const selected = await token(page, '--color-surface-selected');
  const primary = await token(page, '--color-primary');
  expect((await look(entry(page, hosted))).background).toBe(selected);
  for (const folder of [other, outside]) {
    const plain = await look(entry(page, folder));
    expect(plain.background, `${folder}: no selected background`).not.toBe(selected);
    expect(plain.bar, `${folder}: no primary bar`).not.toBe(primary);
  }

  const mark = entry(page, outside).getByTitle(TOOLTIP, { exact: true });
  await expect(mark).toHaveText('Esterna');
  await expect(mark).toBeVisible();
  await expect(mark.locator('svg.icon')).toBeVisible();
  const markBox = await mark.boundingBox();
  const outsideParts = all[2]!;
  expect(markBox!.x, '"Esterna" after the folder').toBeGreaterThanOrEqual(outsideParts.folder!.right - 0.5);
  expect(markBox!.x + markBox!.width, '"Esterna" before the time').toBeLessThanOrEqual(outsideParts.time!.left + 0.5);
  for (const folder of [hosted, other]) {
    await expect(entry(page, folder), `${folder}: no external mark`).not.toContainText('Esterna');
    await expect(entry(page, folder).getByTitle(TOOLTIP)).toHaveCount(0);
  }

  await expect(counter(page), 'no session needs input: no chip').toHaveCount(0);
  const titleBox = await list(page).getByRole('heading', { level: 1, name: 'Sessioni', exact: true }).boundingBox();
  const firstEntryBox = await entries(page).first().boundingBox();
  expect(titleBox!.y + titleBox!.height, 'panel head above the entries').toBeLessThanOrEqual(firstEntryBox!.y + 0.5);
});

// plan-claude_sessions_client-ui_redesign/REQ-11; SessionList: a long label or folder is cut with an ellipsis and its tooltip is the full value
test('a long label and a long folder are cut on one line with an ellipsis and keep the full value as tooltip', async ({ page, request }) => {
  await showOnlyOwnSessions(page);
  const short = await newFolder('short');
  const long = await newFolder(`progetto-con-un-nome-davvero-molto-lungo-${'per-la-barra-laterale-'.repeat(6)}fine`);
  const shortId = await startViaApi(request, short);
  const longId = await startViaApi(request, long);
  await postHook(request, longId, {
    hook_event_name: 'UserPromptSubmit',
    prompt: `Riscrivi il modulo di autenticazione ${'e aggiorna la documentazione '.repeat(4)}`,
  });
  await page.goto('/');
  await expect(entry(page, long)).toBeVisible();
  const longLabel = await labelOf(request, longId);
  expect(longLabel.length, 'fixture label is long').toBeGreaterThan(60);

  for (const value of [longLabel, long]) {
    const cut = await entry(page, long)
      .getByTitle(value, { exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { text: el.textContent, whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, overflowing: el.scrollWidth > el.clientWidth };
      });
    expect(cut.text, 'full value in the element').toBe(value);
    expect(cut.textOverflow, 'ellipsis').toBe('ellipsis');
    expect(cut.whiteSpace, 'one line').toBe('nowrap');
    expect(cut.overflowing, 'the value is cut').toBe(true);
  }

  const all = [await parts(entry(page, short), await labelOf(request, shortId), short), await parts(entry(page, long), longLabel, long)];
  all.forEach((p, i) => expectTwoLines(p, ['short', 'long'][i]!));
  expectSamePlaces(all);
  for (const p of all) {
    for (const r of [p.label!, p.state!, p.folder!, p.time!]) expect(r.right, 'inside the entry').toBeLessThanOrEqual(p.entry.right + 0.5);
  }
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
