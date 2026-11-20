// e2e of plan-dark_blue_theme, batch shared-shapes. The server reads the fixture Claude Code folder E2E_CLAUDE_DIR.
/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { E2E_CLAUDE_DIR } from './claude-dir';
import { cardOf, settingsButton, settingsPopup } from './settings';

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];
const FRAME_SHADOW = 'rgba(0, 0, 0, 0.45) 0px 8px 24px -4px';

let projectsRoot: string;

test.beforeEach(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
  await mkdir(path.join(E2E_CLAUDE_DIR, 'projects'), { recursive: true });
  projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'ai-client-e2e-shared-shapes-'));
});

test.afterEach(async () => {
  await rm(projectsRoot, { recursive: true, force: true });
});

test.afterAll(async () => {
  await rm(E2E_CLAUDE_DIR, { recursive: true, force: true });
});

const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });

/** A project folder with one past conversation, so the Resume dialog and the project list show a row. */
async function pastConversation(name: string): Promise<{ folder: string; prompt: string }> {
  const folder = path.join(projectsRoot, name);
  await mkdir(folder, { recursive: true });
  const id = randomUUID();
  const prompt = `Work in ${name}`;
  const dir = path.join(E2E_CLAUDE_DIR, 'projects', folder.replaceAll('/', '-'));
  await mkdir(dir, { recursive: true });
  const common = { cwd: folder, sessionId: id, isSidechain: false };
  const lines = [
    { ...common, type: 'user', message: { role: 'user', content: prompt } },
    { ...common, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ];
  await writeFile(path.join(dir, `${id}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return { folder, prompt };
}

async function openIn(page: Page, theme: Theme, look: 'macos' | 'windows11' = 'macos'): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([t, l]) => {
      localStorage.setItem('ai-client.theme', t);
      localStorage.setItem('ai-client.look', l);
    },
    [theme, look],
  );
  await page.reload();
  if (theme === 'light') await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  await expect(rail(page)).toBeVisible();
}

/** The colour the browser computes for a CSS colour value (e.g. `var(--border-strong)`). */
const colourOf = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement('span');
    probe.style.color = v;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, value);

/** The length the browser computes for a CSS length value (e.g. `var(--radius-card)`). */
const lengthOf = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement('span');
    probe.style.width = v;
    probe.style.display = 'block';
    probe.style.position = 'absolute';
    document.body.append(probe);
    const width = getComputedStyle(probe).width;
    probe.remove();
    return width;
  }, value);

interface Shape {
  radius: string;
  background: string;
  borderWidth: string;
  borderColour: string;
  leftWidth: string;
  shadow: string;
  font: string;
}
const shapeOf = (locator: Locator): Promise<Shape> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      radius: s.borderTopLeftRadius,
      background: s.backgroundColor,
      borderWidth: s.borderTopWidth,
      borderColour: s.borderTopColor,
      leftWidth: s.borderLeftWidth,
      shadow: s.boxShadow,
      font: s.fontFamily,
    };
  });

/** The computed `box-shadow` of a shadow value or `var()`. */
const shadowOf = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement('div');
    probe.style.boxShadow = v;
    document.body.append(probe);
    const result = getComputedStyle(probe).boxShadow;
    probe.remove();
    return result;
  }, value);

/** Colours of the active theme's levels and of the role tokens with a Light value of their own, as the browser computes them. */
async function levels(page: Page) {
  const names = ['--bg-canvas', '--bg-surface-1', '--bg-surface-2', '--bg-surface-3', '--border-subtle', '--border-strong', '--accent-primary', '--accent-border', '--role-card-active', '--role-pill'];
  const values = await Promise.all(names.map((n) => colourOf(page, `var(${n})`)));
  return Object.fromEntries(names.map((n, i) => [n, values[i] as string])) as Record<string, string>;
}

/** `--bg-surface-2` as content inside `scope` sees it: in a Light popup, the soft tint `--popup-inner-fill` (ThemeTokens). */
const surfaceIn = (scope: Locator) =>
  scope.evaluate((el) => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--bg-surface-2)';
    el.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return { '--bg-surface-2': result };
  });

/** The channels of a computed colour: `rgb()`, `rgba()` or `color(srgb …)`, on a 0-255 scale, alpha 0-1. */
function channels(colour: string): number[] {
  const rgb = colour.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  const srgb = colour.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  throw new Error(`unknown colour ${colour}`);
}

/** A frame or floating panel: 8 px corners, 1 px strong border, frame shadow, popup glass (raised surface at 60 %, plan-popup_glass/REQ-1). */
async function expectFrame(page: Page, locator: Locator, what: string): Promise<void> {
  const level = await levels(page);
  // A Dialog frame paints its glass and border on a layer behind its content (WebEntry `.vx-popup-glass`).
  const own = await shapeOf(locator);
  const layer = await locator.evaluate((el) => {
    const b = getComputedStyle(el, '::before');
    return b.content === 'none' || b.content === 'normal' ? null : { background: b.backgroundColor, borderWidth: b.borderTopWidth, borderColour: b.borderTopColor };
  });
  const s = own.background === 'rgba(0, 0, 0, 0)' && layer ? { ...own, ...layer } : own;
  expect(s.radius, `${what}: radius`).toBe('8px');
  expect([s.borderWidth, s.borderColour], `${what}: border`).toEqual(['1px', level['--border-strong']]);
  expect(s.shadow, `${what}: frame shadow`).toContain(FRAME_SHADOW);
  const [r, g, b, a] = channels(level['--bg-surface-2']!);
  const glass = [r!, g!, b!, a! * 0.6];
  const got = channels(s.background);
  for (let i = 0; i < 4; i++) expect(Math.abs(got[i]! - glass[i]!), `${what}: popup glass ${s.background}`).toBeLessThanOrEqual(i < 3 ? 1 : 0.01);
}

// plan-dark_blue_theme/REQ-2 (started here), REQ-3: the role tokens of ThemeTokens point to the levels of the active set.
for (const theme of THEMES) {
  test(`${theme}: every role token equals its level and the shape tokens have the mock's values`, async ({ page }) => {
    await openIn(page, theme);
    const pairs: Array<[string, string]> = [
      ['--role-canvas', '--bg-canvas'],
      ['--role-list', '--bg-surface-1'],
      ['--role-chrome', '--bg-surface-1'],
      ['--role-card', '--bg-surface-2'],
      ['--role-raised', '--bg-surface-2'],
      // ThemeTokens (plan-cool_slate_light): Light gives the active card a value of its own.
      ...(theme === 'dark' ? ([['--role-card-active', '--bg-surface-3']] as Array<[string, string]>) : []),
      ['--role-border-subtle', '--border-subtle'],
      ['--role-border-strong', '--border-strong'],
      ['--role-accent', '--accent-primary'],
      ['--role-accent-glow', '--accent-glow'],
      ['--role-accent-border', '--accent-border'],
    ];
    for (const [role, level] of pairs) {
      expect(await colourOf(page, `var(${role}, rgb(1, 2, 3))`), `${role} is defined`).not.toBe('rgb(1, 2, 3)');
      expect(await colourOf(page, `var(${role})`), `${role} = ${level}`).toBe(await colourOf(page, `var(${level})`));
    }
    expect(await lengthOf(page, 'var(--radius-pill)')).toBe('5px');
    expect(await lengthOf(page, 'var(--radius-card)')).toBe('7px');
    expect(await lengthOf(page, 'var(--radius-frame)')).toBe('8px');
  });
}

test('the role tokens take different values in Light and Dark', async ({ page }) => {
  const values: Record<Theme, string[]> = { light: [], dark: [] };
  for (const theme of THEMES) {
    await openIn(page, theme);
    for (const role of ['--role-canvas', '--role-card', '--role-card-active']) values[theme].push(await colourOf(page, `var(${role})`));
  }
  values.light.forEach((colour, i) => expect(colour, `role ${i} differs between themes`).not.toBe(values.dark[i]));
});

// plan-dark_blue_theme/REQ-2: the Windows 11 look keeps its own 4 px and 8 px corners.
test('the Windows 11 look gives the shape tokens its 4 px and 8 px corners', async ({ page }) => {
  for (const theme of THEMES) {
    await openIn(page, theme, 'windows11');
    await expect(page.locator('html')).toHaveAttribute('data-look', 'windows11');
    expect(await lengthOf(page, 'var(--radius-pill)'), `${theme}: pill`).toBe('4px');
    expect(await lengthOf(page, 'var(--radius-card)'), `${theme}: card`).toBe('8px');
    expect(await lengthOf(page, 'var(--radius-frame)'), `${theme}: frame`).toBe('8px');
  }
});

// plan-dark_blue_theme/REQ-5
test('Roboto Flex and Roboto Mono stay the fonts in Light and Dark', async ({ page }) => {
  for (const theme of THEMES) {
    await openIn(page, theme);
    const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(body, `${theme}: UI font`).toMatch(/^["']?Roboto Flex["']?/);
    await settingsButton(page).click();
    await settingsPopup(page).getByRole('tab', { name: 'Shortcuts', exact: true }).click();
    const badge = settingsPopup(page).locator('.kbd-badge').first();
    await expect(badge).toBeVisible();
    expect((await shapeOf(badge)).font, `${theme}: mono font`).toMatch(/^["']?Roboto Mono["']?/);
  }
});

// plan-dark_blue_theme/REQ-3 — scenario "dialogs and panels share the new shapes in Light and Dark"
for (const theme of THEMES) {
  test(`${theme}: the Settings popup has the mock's frame, menu items, cards, key badges and update card`, async ({ page }) => {
    await openIn(page, theme);
    const level = await levels(page);
    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await expect(popup).toBeVisible();
    await expectFrame(page, popup, 'Settings frame');
    const inner = await surfaceIn(popup);

    const appearance = popup.getByRole('tab', { name: 'Appearance', exact: true });
    await appearance.click();
    const item = await shapeOf(appearance);
    expect(item.radius, 'menu item: card radius').toBe('7px');
    expect([item.borderWidth, item.borderColour], 'chosen menu item: accent border').toEqual(['1px', level['--accent-primary']]);

    const active = cardOf(popup.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }));
    const other = cardOf(popup.getByRole('radio', { name: theme === 'light' ? 'Dark' : 'Light', exact: true }));
    await page.mouse.move(0, 0);
    const plain = await shapeOf(other);
    expect(plain.radius, 'choice card: card radius').toBe('7px');
    expect(plain.background, 'choice card: card surface').toBe(inner['--bg-surface-2']);
    expect([plain.borderWidth, plain.borderColour], 'choice card: subtle border').toEqual(['1px', level['--border-subtle']]);
    const checked = await shapeOf(active);
    expect(checked.borderColour, 'checked card: accent border').toBe(level['--accent-primary']);
    expect(checked.shadow, 'checked card: card shadow').toContain(await shadowOf(page, 'var(--shadow-card)'));

    await popup.getByRole('tab', { name: 'Shortcuts', exact: true }).click();
    const badge = popup.locator('.kbd-badge').first();
    await expect(badge).toBeVisible();
    const pill = await shapeOf(badge);
    expect(pill.radius, 'key badge: pill radius').toBe('5px');
    expect([pill.borderWidth, pill.borderColour], 'key badge: pill border').toEqual(['1px', level['--border-strong']]);
    expect(pill.background, 'key badge: pill surface').toBe(level['--role-pill']);

    await popup.getByRole('tab', { name: 'Updates', exact: true }).click();
    const card = await shapeOf(popup.getByRole('region', { name: 'Updates', exact: true }));
    expect(card.radius, 'update card: card radius').toBe('7px');
    expect(card.background, 'update card: card surface').toBe(inner['--bg-surface-2']);
    expect([card.borderWidth, card.borderColour], 'update card: subtle border').toEqual(['1px', level['--border-subtle']]);
    const button = await shapeOf(popup.getByRole('button', { name: 'Check for Updates', exact: true }));
    expect(button.radius, 'neutral button: frame radius').toBe('8px');
    expect([button.borderWidth, button.borderColour], 'neutral button: pill border').toEqual(['1px', level['--border-strong']]);
  });

  test(`${theme}: the Resume dialog shows its past sessions as cards and its search field with the accent focus`, async ({ page }) => {
    const past = await pastConversation('alpha');
    await openIn(page, theme);
    const level = await levels(page);
    await rail(page).getByRole('button', { name: 'Resume', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Resume Session' });
    await expect(dialog).not.toContainText('Loading…');
    await expectFrame(page, dialog, 'Resume frame');
    const inner = await surfaceIn(dialog);

    const radio = dialog.getByRole('region', { name: past.folder }).getByRole('radio', { name: past.prompt, exact: true });
    await expect(radio).toHaveCount(1);
    const row = radio.locator('xpath=ancestor::label[1]');
    await page.mouse.move(0, 0);
    const s = await shapeOf(row);
    expect(s.radius, 'past-session row: card radius').toBe('7px');
    expect(s.background, 'past-session row: card surface').toBe(inner['--bg-surface-2']);
    expect([s.borderWidth, s.borderColour], 'past-session row: subtle border').toEqual(['1px', level['--border-subtle']]);
    expect(s.leftWidth, 'past-session row: 1 px left edge, as a session card').toBe('1px');

    await radio.check();
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await shapeOf(row)).background, { message: 'chosen row: active card' }).toBe(level['--role-card-active']);
    // The border eases to the accent: wait for the end of the transition.
    await expect.poll(async () => (await shapeOf(row)).borderColour, { message: 'chosen row: accent border' }).toBe(level['--accent-primary']);
    const chosen = await shapeOf(row);
    expect(chosen.shadow, 'chosen row: active card shadow').toContain(await shadowOf(page, 'var(--shadow-card-active)'));

    const field = dialog.getByRole('textbox', { name: 'Search Past Sessions' });
    const idle = await shapeOf(field);
    expect(idle.radius, 'field: frame radius').toBe('8px');
    // In a Light popup the field takes the soft tint `--popup-inner-fill` (ThemeTokens); elsewhere the canvas.
    expect(idle.background, 'field: canvas, or the soft tint in Light').toBe(theme === 'light' ? 'rgba(255, 255, 255, 0.5)' : level['--bg-canvas']);
    expect([idle.borderWidth, idle.borderColour], 'field: strong border').toEqual(['1px', level['--border-strong']]);
    await field.focus();
    await expect.poll(async () => (await shapeOf(field)).borderColour, { message: 'focused field: accent border' }).toBe(level['--accent-primary']);
    expect((await shapeOf(field)).shadow, 'focused field: accent ring').toContain(level['--accent-primary']);
  });

  test(`${theme}: the Plan Usage panel has 8 px corners, the strong border and the frame shadow`, async ({ page }) => {
    await page.route(
      (url) => url.pathname === '/api/plan-usage',
      (route) => route.fulfill({ json: { status: 'ok', limits: [{ label: 'Current session', percent: 30, resetsAt: new Date(Date.now() + 3_600_000).toISOString() }] } }),
    );
    await openIn(page, theme);
    await page.getByRole('banner').getByRole('button', { name: 'Plan Usage', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Plan Usage', exact: true });
    await expect(panel).toBeVisible();
    await expectFrame(page, panel, 'Plan Usage panel');
  });

  test(`${theme}: project rows are cards like the session cards`, async ({ page }) => {
    const past = await pastConversation('bravo');
    await openIn(page, theme);
    const level = await levels(page);
    await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
    const row = page.getByRole('region', { name: 'Session List' }).locator('.project-row').filter({ has: page.getByText(past.folder, { exact: true }) });
    await expect(row).toHaveCount(1);
    await page.mouse.move(0, 0);
    const s = await shapeOf(row);
    expect(s.radius, 'project row: card radius').toBe('7px');
    expect(s.background, 'project row: card surface').toBe(level['--bg-surface-2']);
    expect([s.borderWidth, s.borderColour], 'project row: subtle border').toEqual(['1px', level['--border-subtle']]);
  });
}

/**
 * The focused control shows a ring (outline or box-shadow) that no ancestor with clipped overflow cuts.
 * A visually hidden input (e.g. the radio of a choice card) shows its ring on its label.
 */
function focusRing(page: Page): Promise<{ name: string; ring: boolean; clippedBy: string | null }> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return { name: 'body', ring: false, clippedBy: null };
    const ringOf = (el: Element) => {
      const s = getComputedStyle(el);
      const outlineWidth = s.outlineStyle !== 'none' ? parseFloat(s.outlineWidth) : 0;
      const outlineVisible = outlineWidth > 0 && !/rgba\(.*,\s*0\)$/.test(s.outlineColor) && s.outlineColor !== 'transparent';
      const shadowVisible = s.boxShadow !== 'none' && /(rgb|rgba)\(/.test(s.boxShadow);
      // A ring drawn with box-shadow is a crisp spread around the box: no offset and no blur.
      const spreads = [...s.boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px/g)]
        .filter((m) => m[1] === '0' && m[2] === '0' && m[3] === '0')
        .map((m) => parseFloat(m[4] as string));
      const extent = outlineVisible ? Math.max(outlineWidth + parseFloat(s.outlineOffset), 0) : Math.max(...spreads, 0);
      return { visible: outlineVisible || shadowVisible, extent };
    };
    const own = getComputedStyle(active);
    const box0 = active.getBoundingClientRect();
    const hidden = own.opacity === '0' || box0.width <= 1 || box0.height <= 1 || own.clipPath !== 'none' || own.clip !== 'auto';
    let holder: Element = active;
    let ring = ringOf(holder);
    if (!ring.visible || hidden) {
      const label = active.closest('label');
      if (label) {
        holder = label;
        ring = ringOf(label);
      }
    }
    const name = `${holder.tagName.toLowerCase()}.${[...holder.classList].join('.')} "${(active.getAttribute('aria-label') ?? active.textContent ?? '').trim().slice(0, 40)}"`;
    const r = holder.getBoundingClientRect();
    const outer = { left: r.left - ring.extent, top: r.top - ring.extent, right: r.right + ring.extent, bottom: r.bottom + ring.extent };
    for (let node = holder.parentElement; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const b = node.getBoundingClientRect();
      const box = { left: b.left + node.clientLeft, top: b.top + node.clientTop, right: b.left + node.clientLeft + node.clientWidth, bottom: b.top + node.clientTop + node.clientHeight };
      const cut =
        (s.overflowX !== 'visible' && (outer.left < box.left - 0.5 || outer.right > box.right + 0.5)) ||
        (s.overflowY !== 'visible' && (outer.top < box.top - 0.5 || outer.bottom > box.bottom + 0.5));
      const at = (x: { left: number; top: number; right: number; bottom: number }) => [x.left, x.top, x.right, x.bottom].map((n) => Math.round(n * 10) / 10).join(',');
      if (cut) return { name, ring: ring.visible, clippedBy: `${node.tagName.toLowerCase()}.${[...node.classList].join('.')} [ring ${at(outer)} / box ${at(box)}]` };
    }
    return { name, ring: ring.visible, clippedBy: null };
  });
}

/** Presses Tab until the focus comes back to a control already seen (or `max` times) and checks every stop. */
async function tabThrough(page: Page, where: string, max = 40): Promise<number> {
  const seen = new Set<string>();
  let stops = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const key = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return 'body';
      const path: number[] = [];
      for (let n: Element | null = el; n && n.parentElement; n = n.parentElement) path.push([...n.parentElement.children].indexOf(n));
      return path.join('/');
    });
    if (key === 'body') continue;
    if (seen.has(key)) break;
    seen.add(key);
    stops += 1;
    const result = await focusRing(page);
    expect.soft(result.ring, `${where}: ${result.name} shows a focus ring`).toBe(true);
    expect.soft(result.clippedBy, `${where}: ${result.name} ring is not cut`).toBeNull();
  }
  return stops;
}

// plan-dark_blue_theme/REQ-4 — scenario "the keyboard focus stays visible"
for (const theme of THEMES) {
  test(`${theme}: every control of the page reached with Tab shows a focus ring that nothing cuts`, async ({ page }) => {
    await pastConversation('charlie');
    await openIn(page, theme);
    await rail(page).getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Session List' }).locator('.project-row')).toHaveCount(1);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    expect(await tabThrough(page, `${theme} page`), 'Tab reaches some controls').toBeGreaterThan(3);
  });

  test(`${theme}: every control of the Settings popup reached with Tab shows a focus ring that nothing cuts`, async ({ page }) => {
    await openIn(page, theme);
    await settingsButton(page).click();
    const popup = settingsPopup(page);
    await expect(popup).toBeVisible();
    for (const section of ['Appearance', 'Shortcuts', 'Updates']) {
      await popup.getByRole('tab', { name: section, exact: true }).click();
      expect(await tabThrough(page, `${theme} Settings ${section}`), `${section}: Tab reaches some controls`).toBeGreaterThan(1);
    }
  });
}
