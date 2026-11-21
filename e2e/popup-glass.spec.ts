// e2e of plan-popup_glass, batch glass-popups: every popup is the raised surface at 60 % with an 8 px blur of what lies
// behind it. Expected values come from the REQs, ThemeTokens ("Popup glass tokens") and the specs of the popups.
/// <reference lib="dom" />
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { currentView, pageSettled, settled } from './motion';
import { cardOf, settingsButton, settingsPopup } from './settings';

type Rgba = [number, number, number, number];

const BLUR = 'blur(8px)';
const BACKDROP_DIM: Rgba = [0, 0, 0, 0.65];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

let projectsRoot: string;
const createdIds: string[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async () => {
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-popup-glass-'));
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds.splice(0)) await request.post(`/api/sessions/${id}/stop`);
  await rm(projectsRoot, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const railButton = (page: Page, name: string) => rail(page).getByRole('button', { name, exact: true });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const entry = (page: Page, folder: string) => list(page).getByRole('button').filter({ has: page.getByTitle(folder, { exact: true }) });
const terminal = (page: Page) => currentView(page).locator('.xterm-rows');
const backdropOf = (dialog: Locator) => dialog.locator('xpath=..');

/**
 * A computed property of the surface's glass. The Dialog frame paints its glass, border and top line on a layer behind its
 * content (its `::before`, WebEntry `.vx-popup-glass`); other popups paint it on themselves.
 */
const glassStyle = (surface: Locator, property: string) =>
  surface.evaluate((el, name) => {
    const layer = getComputedStyle(el, '::before');
    const onLayer = getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && layer.content !== 'none' && layer.content !== 'normal';
    return (onLayer ? layer : getComputedStyle(el)).getPropertyValue(name);
  }, property);

/** Parses a computed colour: `rgb()`, `rgba()` or the `color(srgb …)` form Chromium gives for `color-mix()`. */
function parse(colour: string): Rgba {
  const rgb = colour.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  const srgb = colour.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  if (colour === 'transparent') return TRANSPARENT;
  throw new Error(`unknown colour ${colour}`);
}

function expectColour(actual: string, expected: Rgba, what: string): void {
  const got = parse(actual);
  const message = `${what}: ${actual} is not rgba(${expected.join(', ')})`;
  for (let i = 0; i < 3; i++) expect(Math.abs(got[i]! - expected[i]!), message).toBeLessThanOrEqual(1);
  expect(Math.abs(got[3] - expected[3]), message).toBeLessThanOrEqual(0.01);
}

const style = (target: Locator, property: string) => target.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

/** The value of a colour expression in the page, e.g. `var(--role-raised)`. */
const resolved = (page: Page, expression: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, expression);

/** ThemeTokens: the popup glass is `--role-raised` of the active set at 60 % opacity. */
async function glass(page: Page): Promise<Rgba> {
  const [r, g, b, a] = parse(await resolved(page, 'var(--role-raised)'));
  return [r, g, b, a * 0.6];
}

/** REQ-1, REQ-2, REQ-6: the surface is the popup glass with the 8 px blur, and its text keeps the theme's text colour. */
async function expectGlass(page: Page, surface: Locator, what: string, text = surface): Promise<void> {
  expectColour(await glassStyle(surface, 'background-color'), await glass(page), `${what} background`);
  expect(await glassStyle(surface, 'backdrop-filter'), `${what} blur`).toBe(BLUR);
  expectColour(await style(text, 'color'), parse(await resolved(page, 'var(--text-primary)')), `${what} text`);
  // Polled: a session switch cross-fades the whole view for a moment.
  await expect.poll(() => blurBlockers(surface), { message: `${what}: ancestors that keep the page from its blur` }).toEqual([]);
}

/**
 * Ancestors that would stop the surface's backdrop blur before the page (batch note "Blur and the open effects"):
 * opacity below 1, a filter, a backdrop filter, a blend mode, a mask or a clip path.
 */
const blurBlockers = (surface: Locator) =>
  surface.evaluate((el) => {
    const found: string[] = [];
    for (let node = el.parentElement; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      const name = `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`;
      if (Number(s.opacity) < 1) found.push(`${name} opacity ${s.opacity}`);
      if (s.filter !== 'none') found.push(`${name} filter ${s.filter}`);
      if (s.backdropFilter !== 'none') found.push(`${name} backdrop-filter ${s.backdropFilter}`);
      if (s.mixBlendMode !== 'normal') found.push(`${name} mix-blend-mode ${s.mixBlendMode}`);
      if (s.maskImage !== 'none') found.push(`${name} mask ${s.maskImage}`);
      if (s.clipPath !== 'none') found.push(`${name} clip-path ${s.clipPath}`);
    }
    return found;
  });

/** Descendants of the surface with a backdrop filter of their own (REQ-9: blur only the popup surface). */
const blurredChildren = (surface: Locator) =>
  surface.evaluate((el) =>
    [...el.querySelectorAll('*')].filter((node) => getComputedStyle(node).backdropFilter !== 'none').map((node) => node.className.toString()),
  );

/** Shows in the page only the sessions of this test: other specs leave theirs on the server. */
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

async function startViaApi(request: APIRequestContext, name: string): Promise<{ id: string; folder: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder);
  const response = await request.post('/api/sessions', { data: { path: folder } });
  expect(response.status()).toBe(201);
  const id = ((await response.json()) as { id: string }).id;
  createdIds.push(id);
  return { id, folder };
}

/** Opens the session from the list and fills every row of its terminal with text: one long line, echoed and wrapped. */
async function openBusyTerminal(page: Page, folder: string): Promise<void> {
  await entry(page, folder).getByTitle(folder, { exact: true }).click();
  await expect(terminal(page)).toContainText('READY');
  await currentView(page).locator('.xterm-screen').click();
  await page.keyboard.insertText(`${'lorem ipsum dolor sit amet '.repeat(150)}END`);
  await page.keyboard.press('Enter');
  await expect(terminal(page)).toContainText('LINE:');
  await expect(terminal(page)).toContainText('amet END');
  await pageSettled(page);
}

async function openSettings(page: Page): Promise<Locator> {
  await settingsButton(page).click();
  const dialog = settingsPopup(page);
  await expect(dialog).toBeVisible();
  await pageSettled(page);
  return dialog;
}

/** Sum of the colour steps between neighbouring pixels of a PNG: high for sharp text, low for blurred content. */
const sharpness = (page: Page, png: Buffer) =>
  page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let sum = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) sum += Math.abs(data[i + c]! - data[i - 4 + c]!);
      }
    }
    return sum;
  }, png.toString('base64'));

/** Screenshot of `clip` with or without the surface's blur; `bare` hides the surface's content so only its glass shows. */
async function shotOf(page: Page, surface: Locator, clip: { x: number; y: number; width: number; height: number }, blur: boolean, bare = false): Promise<Buffer> {
  await surface.evaluate(
    (el, [on, hide]) => {
      // The blur may sit on the surface or on its glass layer (`::before`): the switch covers both.
      if (!document.getElementById('no-glass-blur')) {
        const sheet = Object.assign(document.createElement('style'), { id: 'no-glass-blur' });
        sheet.textContent = '[data-no-glass-blur], [data-no-glass-blur]::before { backdrop-filter: none !important; }';
        document.head.append(sheet);
      }
      el.toggleAttribute('data-no-glass-blur', !on);
      for (const child of el.children) (child as HTMLElement).style.visibility = hide ? 'hidden' : '';
    },
    [blur, bare] as const,
  );
  await page.evaluate(() => new Promise(requestAnimationFrame));
  return page.screenshot({ clip, animations: 'disabled' });
}

// ---------------------------------------------------------------------------------------------------------------------
test.describe('dialogs', () => {
  // REQ-1, REQ-2, REQ-5, REQ-6, REQ-8 — scenario "popups show the terminal through a blurred, see-through background"
  test('the Settings dialog is the 60 % glass with an 8 px blur, its parts have no fill and its controls stay opaque', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'settings-glass');
    await page.goto('/');
    await openBusyTerminal(page, folder);
    const dialog = await openSettings(page);

    await expectGlass(page, dialog, 'Settings frame', dialog.getByRole('heading').first());

    // REQ-8: the backdrop keeps the 65 % black dim and has no blur.
    expectColour(await style(backdropOf(dialog), 'background-color'), BACKDROP_DIM, 'backdrop dim');
    expect(await style(backdropOf(dialog), 'backdrop-filter'), 'backdrop blur').toBe('none');
    expect(await blurredChildren(dialog), 'children with a blur of their own').toEqual([]);

    // SettingsDialog: the menu column and the pane header have no fill of their own.
    const menu = dialog.getByRole('tablist', { name: 'Settings sections' });
    expectColour(await style(menu, 'background-color'), TRANSPARENT, 'menu column');
    const paneHeader = dialog.locator('.settings-pane:not([hidden]) .settings-pane-header');
    await expect(paneHeader).toHaveCount(1);
    expectColour(await style(paneHeader, 'background-color'), TRANSPARENT, 'pane header');
    // Dialog: the header and the footer have no fill of their own.
    for (const part of await dialog.locator('.dialog-header, .modal-actions').all()) {
      expectColour(await style(part, 'background-color'), TRANSPARENT, `dialog part ${await part.getAttribute('class')}`);
    }

    // REQ-5: text, borders and controls stay fully opaque.
    expectColour(await glassStyle(dialog, 'border-top-color'), parse(await resolved(page, 'var(--role-border-strong)')), 'frame border');
    const selected = dialog.getByRole('tab', { selected: true });
    expect(parse(await style(selected, 'background-color'))[3], 'the selected menu row keeps its active fill').toBeGreaterThan(0);
    expect(parse(await style(selected, 'color'))[3], 'menu row text').toBe(1);
    const close = dialog.getByRole('button', { name: 'Close', exact: true });
    expect(parse(await style(close, 'background-color'))[3], '"Close" fill').toBe(1);
    expect(parse(await style(close, 'color'))[3], '"Close" text').toBe(1);
  });

  // REQ-1, REQ-5 — Dialog "Shows": header and footer without fills, the primary action keeps its accent fill
  test('the new-session dialog frame is the glass, its header and footer have no fill and its buttons stay opaque', async ({ page }) => {
    await page.goto('/');
    await railButton(page, 'New Claude Code Session').click();
    const dialog = page.getByRole('dialog', { name: 'New Claude Code Session' });
    await expect(dialog).toBeVisible();
    await settled(dialog);

    await expectGlass(page, dialog, 'new-session frame', dialog.getByRole('heading', { name: 'New Claude Code Session' }));
    const header = dialog.getByRole('heading', { name: 'New Claude Code Session' }).locator('xpath=..');
    expectColour(await style(header, 'background-color'), TRANSPARENT, 'header');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    const footer = cancel.locator('xpath=..');
    expectColour(await style(footer, 'background-color'), TRANSPARENT, 'footer');
    expect(parse(await style(cancel, 'background-color'))[3], '"Cancel" fill').toBe(1);
    const start = dialog.getByRole('button', { name: 'Start Session', exact: true });
    expectColour(await style(start, 'background-color'), parse(await resolved(page, 'var(--accent-primary)')), '"Start Session" fill');
    const field = dialog.getByRole('textbox', { name: 'Working Directory Path', exact: true });
    expect(parse(await style(field, 'background-color'))[3], 'field fill').toBe(1);
  });

  // REQ-2, REQ-8, REQ-10: the backdrop fades its dim, never its opacity, so the frame blur reaches the page during the effects
  test('while the dialog opens and leaves, the backdrop stays at full opacity and only its dim fades', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--motion-duration-enter', '4000ms');
      document.documentElement.style.setProperty('--motion-duration-exit', '4000ms');
    });
    await railButton(page, 'New Claude Code Session').click();
    const dialog = page.getByRole('dialog', { name: 'New Claude Code Session' });
    await expect(dialog).toBeVisible();
    const backdrop = backdropOf(dialog);

    /** Holds the backdrop's effect at its middle and reads opacity and dim there. */
    const middle = () =>
      backdrop.evaluate((el) => {
        const effects = el.getAnimations().filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
        for (const animation of effects) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getComputedTiming().endTime) / 2;
        }
        const s = getComputedStyle(el);
        return { effects: effects.length, opacity: s.opacity, dim: s.backgroundColor };
      });
    const resume = () => backdrop.evaluate((el) => el.getAnimations().forEach((animation) => animation.play()));

    const opening = await middle();
    expect(opening.effects, 'the backdrop plays its enter effect').toBeGreaterThan(0);
    expect(opening.opacity, 'backdrop opacity while it enters').toBe('1');
    const openDim = parse(opening.dim)[3];
    expect(openDim, 'the dim fades in').toBeGreaterThan(0);
    expect(openDim, 'the dim fades in').toBeLessThan(0.65);
    expect(await glassStyle(dialog, 'backdrop-filter')).toBe(BLUR);
    await resume();
    await settled(backdrop);
    expectColour(await style(backdrop, 'background-color'), BACKDROP_DIM, 'dim at rest');

    await page.keyboard.press('Escape');
    const leavingBackdrop = page.locator('.modal-backdrop.is-leaving');
    await expect(leavingBackdrop).toHaveCount(1);
    const leaving = await leavingBackdrop.evaluate((el) => {
      const effects = el.getAnimations().filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
      for (const animation of effects) {
        animation.pause();
        animation.currentTime = Number(animation.effect!.getComputedTiming().endTime) / 2;
      }
      const s = getComputedStyle(el);
      return { effects: effects.length, opacity: s.opacity, dim: s.backgroundColor };
    });
    expect(leaving.effects, 'the backdrop plays its leave effect').toBeGreaterThan(0);
    expect(leaving.opacity, 'backdrop opacity while it leaves').toBe('1');
    const leaveDim = parse(leaving.dim)[3];
    expect(leaveDim, 'the dim fades out').toBeGreaterThan(0);
    expect(leaveDim, 'the dim fades out').toBeLessThan(0.65);
    await leavingBackdrop.evaluate((el) => el.getAnimations().forEach((animation) => animation.play()));
    await expect(page.locator('.modal-backdrop')).toHaveCount(0, { timeout: 10_000 });
  });

  // REQ-4, REQ-6 — scenario "the glass looks the same in every theme"
  test('the Settings dialog keeps the 60 % glass and the theme text colour in Light, Dark, Dark Blue and the Windows 11 look', async ({ page }) => {
    await page.goto('/');
    const dialog = await openSettings(page);
    await dialog.getByRole('tab', { name: 'Appearance', exact: true }).click();
    const title = dialog.getByRole('heading').first();
    for (const [choice, mark, value] of [
      ['Light', 'data-theme', 'light'],
      ['Dark', 'data-theme', 'dark'],
      ['Dark Blue', 'data-theme', 'dark-blue'],
      ['Windows 11', 'data-look', 'windows11'],
    ] as const) {
      await cardOf(dialog.getByRole('radio', { name: choice, exact: true })).click();
      await expect.poll(() => page.locator('html').getAttribute(mark)).toBe(value);
      await pageSettled(page);
      await expectGlass(page, dialog, `${choice}: Settings frame`, title);
    }
  });

  // REQ-7 — scenario "without blur the popup keeps its see-through background"
  test('without backdrop blur the dialog keeps the 60 % background and the theme text colour', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: '*, *::before, *::after { backdrop-filter: none !important; }' });
    const dialog = await openSettings(page);
    expect(await glassStyle(dialog, 'backdrop-filter')).toBe('none');
    expectColour(await glassStyle(dialog, 'background-color'), await glass(page), 'frame background');
    expectColour(await style(dialog.getByRole('heading').first(), 'color'), parse(await resolved(page, 'var(--text-primary)')), 'title text');
  });

  // REQ-6: over a busy terminal the content behind the frame shows blurred, not sharp
  test('the terminal text behind the Settings dialog shows blurred', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'blur-pixels');
    await page.goto('/');
    await openBusyTerminal(page, folder);
    const region = await currentView(page).locator('.xterm-screen').boundingBox();
    const dialog = await openSettings(page);
    const frame = (await dialog.boundingBox())!;
    // The part of the frame over the terminal, below the frame's own header row.
    const clip = {
      x: Math.max(frame.x, region!.x) + 2,
      y: frame.y + frame.height - 60,
      width: Math.min(frame.x + frame.width, region!.x + region!.width) - Math.max(frame.x, region!.x) - 4,
      height: 50,
    };
    expect(clip.width, 'the frame lies over the terminal').toBeGreaterThan(40);
    const sharp = await sharpness(page, await shotOf(page, dialog, clip, false));
    const blurred = await sharpness(page, await shotOf(page, dialog, clip, true));
    expect(blurred, `blurred ${blurred} against sharp ${sharp}`).toBeLessThan(sharp * 0.8);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('popovers, tooltips and notices', () => {
  // REQ-1, REQ-2 — NavigationRail "Shows": the rail tooltip, in the dark and in the light theme (assumption "Opacity against readability")
  test('the rail tooltip is the glass in the dark and in the light theme', async ({ page }) => {
    await page.goto('/');
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => localStorage.setItem('ai-client.theme', value), theme);
      await page.reload();
      await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe(theme);
      const sessions = railButton(page, 'Sessions');
      await sessions.hover();
      const tooltip = sessions.locator('.vx-tooltip');
      await expect.poll(() => style(tooltip, 'opacity')).toBe('1');
      await expectGlass(page, tooltip, `${theme}: rail tooltip`);
      await page.mouse.move(700, 450);
    }
  });

  // REQ-1, REQ-2 — SettingsButton: its tooltip follows the rail look
  test('the Settings button tooltip is the glass', async ({ page }) => {
    await page.goto('/');
    await settingsButton(page).hover();
    const tooltip = settingsButton(page).locator('.vx-tooltip');
    await expect.poll(() => style(tooltip, 'opacity')).toBe('1');
    await expectGlass(page, tooltip, 'Settings tooltip');
  });

  // REQ-1, REQ-2 — PlanUsagePopover "Shows"
  test('the Plan Usage popover is the glass', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Plan Usage', exact: true }).click();
    const popover = page.getByRole('dialog', { name: 'Plan Usage', exact: true });
    await expect(popover).toBeVisible();
    await settled(popover);
    await expectGlass(page, popover, 'Plan Usage popover', popover.getByText('Plan Usage', { exact: true }).first());
    expect(await blurredChildren(popover), 'children with a blur of their own').toEqual([]);
  });

  // REQ-1, REQ-2, REQ-6 — TerminalSearchBox "Shows": the box over a busy terminal, the text behind it blurred
  test('the terminal search box is the glass and blurs the terminal text behind it', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'search-glass');
    await page.goto('/');
    await openBusyTerminal(page, folder);
    await page.keyboard.press('Control+Shift+F');
    const box = page.getByRole('search', { name: 'Terminal search' });
    await expect(box).toBeVisible();
    await settled(box);
    expectColour(await style(box, 'background-color'), await glass(page), 'search box background');
    expect(await style(box, 'backdrop-filter')).toBe(BLUR);
    expect(await blurBlockers(box)).toEqual([]);
    const field = box.getByRole('textbox', { name: 'Search in terminal' });
    expect(parse(await style(field, 'color'))[3], 'field text').toBe(1);

    const b = (await box.boundingBox())!;
    const clip = { x: b.x + 2, y: b.y + 2, width: b.width - 4, height: b.height - 4 };
    const sharp = await sharpness(page, await shotOf(page, box, clip, false, true));
    const blurred = await sharpness(page, await shotOf(page, box, clip, true, true));
    expect(blurred, `blurred ${blurred} against sharp ${sharp}`).toBeLessThan(sharp * 0.8);
  });

  // REQ-1, REQ-2, REQ-6 — SessionView "Shows": the address tooltip of a terminal hyperlink
  test('the address tooltip of a terminal hyperlink is the glass', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'link-glass');
    await page.goto('/');
    await entry(page, folder).getByTitle(folder, { exact: true }).click();
    await expect(terminal(page)).toContainText('READY');
    await currentView(page).locator('.xterm-screen').click();
    await page.keyboard.type('LINKS');
    await page.keyboard.press('Enter');
    await expect(terminal(page)).toContainText('LINKS-DONE');
    // The hyperlink of the row that starts with "OSC8:" hides its address behind the text "docs".
    const point = await terminal(page).evaluate((rows) => {
      const row = [...rows.children].find((r) => r.textContent?.startsWith('OSC8:'));
      const walker = document.createTreeWalker(row!, NodeFilter.SHOW_TEXT);
      let offset = 6;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.textContent?.length ?? 0;
        if (offset < length) {
          const range = document.createRange();
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
          const r = range.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
        offset -= length;
      }
      throw new Error('no hyperlink cell');
    });
    await page.mouse.move(point.x, point.y);
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expectGlass(page, tooltip, 'link tooltip');
  });

  // REQ-1, REQ-2 — SessionHeader "Shows": the tooltip of the line pill
  test('the tooltip of the line pill in the session header is the glass', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'line-glass');
    await page.goto('/');
    await entry(page, folder).getByTitle(folder, { exact: true }).click();
    await expect(terminal(page)).toContainText('READY');
    await pageSettled(page);
    const pill = currentView(page).locator('.session-header-subtitle');
    await expect(pill).toBeVisible();
    await pill.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expectGlass(page, tooltip, 'line pill tooltip');
  });

  // REQ-1, REQ-2 — SessionFigures "Shows": the tokens tooltip. Its real markup is checked by SessionFigures.test.tsx;
  // here the same markup is placed in the page, as a session with token figures needs a recorded conversation.
  test('the CSS of the tokens tooltip gives the glass', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<span class="session-figures"><span class="mono-chip vx-surface-2 session-figure-tokens" tabindex="0">186k tokens' +
          '<span class="session-figure-tokens-tooltip vx-popup-glass" id="probe-tooltip" role="tooltip">Input 4k</span></span></span>',
      );
    });
    await expectGlass(page, page.locator('#probe-tooltip'), 'tokens tooltip');
  });

  // REQ-3 — NeedsInputSnackbar "Shows"
  test('the "needs your input" snackbar is the glass', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const shown = await startViaApi(request, 'shown');
    const waiting = await startViaApi(request, 'waiting');
    await page.goto('/');
    await entry(page, shown.folder).getByTitle(shown.folder, { exact: true }).click();
    await expect(terminal(page)).toContainText('READY');
    const hook = await request.post(`/api/sessions/${waiting.id}/hook-events`, { data: { hook_event_name: 'PermissionRequest', tool_name: 'Bash' } });
    expect(hook.status()).toBe(204);
    const snackbar = page.getByRole('status').filter({ hasText: 'needs your input' });
    await expect(snackbar).toBeVisible();
    await settled(snackbar);
    await expectGlass(page, snackbar, 'snackbar');
    expectColour(await style(snackbar, 'border-top-color'), parse(await resolved(page, 'var(--role-border-strong)')), 'snackbar border');
  });

  // REQ-3 — ShortMessageToast "Shows"
  test('the short-message toast is the glass', async ({ page, request }) => {
    await showOnlyOwnSessions(page);
    const { folder } = await startViaApi(request, 'idle');
    await page.goto('/');
    await expect(entry(page, folder)).toBeVisible();
    await page.keyboard.press('Alt+KeyI');
    const toast = page.getByRole('status').filter({ hasText: 'No session needs input' });
    await expect(toast).toBeVisible();
    await settled(toast);
    await expectGlass(page, toast, 'toast');
  });

  // REQ-3 — NewerVersionNotice "Shows"
  test('the newer-version notice is the glass', async ({ page }) => {
    await page.route('**/api/newer-version', (route) =>
      route.fulfill({ json: { status: 'newer', installedVersion: '0.1.0', newerVersion: '9.9.0', releaseUrl: 'https://example.com/releases/v9.9.0' } }),
    );
    await page.goto('/');
    const notice = page.getByRole('status', { name: 'Update Available' });
    await expect(notice).toBeVisible();
    await settled(notice);
    await expectGlass(page, notice, 'notice', notice.getByText('Update Available', { exact: true }).first());
  });
});
