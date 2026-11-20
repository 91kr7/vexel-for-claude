// e2e of plan-cool_slate_light, popup fixes of batch light-terminal: Light popups read as light surfaces, not grey, and their
// content blends with the glass. Expected values come from table A (plan-cool_slate_light/REQ-1, REQ-11, REQ-13) and the
// specs ThemeTokens, WebEntry, Dialog and ResumeDialog.
/// <reference lib="dom" />
import { type Locator, type Page, expect, test } from '@playwright/test';
import { pageSettled } from './motion';
import { type SettingsChoice, cardOf, chooseInSettings, settingsButton, settingsPopup } from './settings';

type Rgba = [number, number, number, number];

const LIGHT_BACKDROP = 'rgba(15, 23, 42, 0.2)';
const DARK_BACKDROP = 'rgba(0, 0, 0, 0.65)';
const INNER_FILL = 'rgba(255, 255, 255, 0.5)';
const SOLID_WHITE = 'rgb(255, 255, 255)';
// The dialog frame at rest over the empty page, as before the fix in Dark and Dark Blue (about #e8e9ec in Light).
const FRAME_AT_REST: Record<string, Rgba> = { light: [233, 234, 236, 1], dark: [16, 16, 21, 1], 'dark-blue': [20, 23, 34, 1] };
const THEMES: [SettingsChoice, string][] = [['Light', 'light'], ['Dark', 'dark'], ['Dark Blue', 'dark-blue']];
const INNER_TOKENS = ['--bg-surface-2', '--role-card', '--role-raised', '--field-bg'];

test.use({ viewport: { width: 1440, height: 900 } });

const html = (page: Page) => page.locator('html');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const style = (target: Locator, property: string) => target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
const glassOf = (frame: Locator, property: string) => frame.evaluate((el, p) => getComputedStyle(el, '::before').getPropertyValue(p), property);
const resumeDialog = (page: Page) => page.getByRole('dialog', { name: 'Resume Session' });
const newSessionDialog = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });

async function choose(page: Page, choice: SettingsChoice, mark: string): Promise<void> {
  await chooseInSettings(page, choice);
  await expect(html(page)).toHaveAttribute('data-theme', mark);
  await pageSettled(page);
}

/** The computed form of a CSS colour value or `var()`, read inside `scope` (default: the page body). */
async function colour(page: Page, cssValue: string, scope: Locator = page.locator('body')): Promise<string> {
  return scope.evaluate((parent, value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    parent.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, cssValue);
}

function parse(value: string): Rgba {
  const rgb = value.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  const srgb = value.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  throw new Error(`unknown colour ${value}`);
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const near = (actual: Rgba, expected: Rgba, what: string, tolerance = 4) => {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i]! - expected[i]!), `${what}: rgb(${actual.slice(0, 3).join(', ')}) vs rgb(${expected.slice(0, 3).join(', ')})`).toBeLessThanOrEqual(tolerance);
};

/** The most frequent colour of the pixels in `clip`: the background, when text covers only a small part. */
async function dominant(page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<Rgba> {
  const png = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    return [...best.split(',').map(Number), 1] as [number, number, number, number];
  }, png.toString('base64'));
}

async function boxOf(target: Locator) {
  const b = await target.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
}

/** The frame's colour at rest: a strip of its left padding, beside the header row. */
async function frameColour(page: Page, dialog: Locator): Promise<Rgba> {
  const frame = await boxOf(dialog);
  const header = await boxOf(dialog.locator('.dialog-header').first());
  return dominant(page, { x: frame.x + 3, y: header.y + 2, width: 6, height: header.height - 4 });
}

async function openSettings(page: Page): Promise<Locator> {
  await settingsButton(page).click();
  const dialog = settingsPopup(page);
  await expect(dialog).toBeVisible();
  // The dim fades in with the dialog: it is read at rest.
  await pageSettled(page);
  return dialog;
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}

/** Two folders of past sessions, enough rows for the Resume list to scroll; the first session runs in a terminal. */
async function mockPastSessions(page: Page): Promise<void> {
  const group = (folder: string) => ({
    folder,
    available: true,
    sessions: Array.from({ length: 30 }, (_, i) => ({
      id: `${folder.slice(-1)}-${i}`,
      label: `Past session ${folder.slice(-1)}${i + 1}`,
      lastActivity: new Date(Date.UTC(2026, 10, 19, 10, 59 - i)).toISOString(),
      runningElsewhere: i === 0,
    })),
  });
  await page.route(
    (url) => url.pathname === '/api/past-sessions',
    (route) => (route.request().method() === 'GET' ? route.fulfill({ json: [group('/srv/projects/a'), group('/srv/projects/b')] }) : route.fallback()),
  );
}

async function openResume(page: Page): Promise<Locator> {
  await rail(page).getByRole('button', { name: 'Resume', exact: true }).click();
  const dialog = resumeDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Past session b30');
  await pageSettled(page);
  return dialog;
}

/** Visible elements of `scope` that paint a solid white background, outside `except`. */
const solidWhite = (scope: Locator, except: string | null = null) =>
  scope.evaluate(
    (root, [white, skip]) =>
      [root, ...root.querySelectorAll('*')]
        .filter((el) => (!skip || !el.closest(skip)) && el.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
        .filter((el) => getComputedStyle(el).backgroundColor === white)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className)} "${(el.textContent ?? '').trim().slice(0, 30)}"`),
    [SOLID_WHITE, except] as const,
  );

// ---------------------------------------------------------------------------------------------------------------------
test.describe('popup backdrop and frame', () => {
  // plan-cool_slate_light/REQ-1, REQ-11, ThemeTokens and Dialog: the Light dim is a light slate, so the 60 % frame stays a light surface
  test('in Light the backdrop is the light slate dim and the dialog frame reads light, not grey, with its 60 % glass and blur', async ({ page }) => {
    await page.goto('/');
    await choose(page, 'Light', 'light');
    expect(await colour(page, 'var(--color-backdrop)')).toBe(LIGHT_BACKDROP);
    const dialog = await openSettings(page);
    const backdrop = dialog.locator('xpath=..');
    expect(await style(backdrop, 'background-color')).toBe(LIGHT_BACKDROP);
    expect(await style(backdrop, 'backdrop-filter'), 'the backdrop keeps no blur').toBe('none');
    expect(await glassOf(dialog, 'background-color'), 'the frame keeps the popup glass').toBe(await colour(page, 'var(--popup-glass-bg)'));
    expect(parse(await glassOf(dialog, 'background-color'))[3], 'the glass keeps 60 %').toBeCloseTo(0.6, 2);
    expect(await glassOf(dialog, 'backdrop-filter'), 'the glass keeps its blur').toBe('blur(8px)');

    const rest = await frameColour(page, dialog);
    near(rest, FRAME_AT_REST.light!, 'Light frame at rest');
    // The old 65 % black dim gave about #bbbbbb (luminance about 0.5).
    expect(luminance(rest), 'the frame is a light surface').toBeGreaterThan(0.75);
  });

  // plan-cool_slate_light/REQ-13: Dark and Dark Blue keep the 65 % black dim and the frame colour they had
  test('in Dark and Dark Blue the backdrop keeps the 65 % black dim and the frame keeps its colour at rest', async ({ page }) => {
    await page.goto('/');
    for (const [choice, mark] of THEMES.slice(1)) {
      await choose(page, choice, mark);
      expect(await colour(page, 'var(--color-backdrop)'), `${choice} token`).toBe(DARK_BACKDROP);
      const dialog = await openSettings(page);
      expect(await style(dialog.locator('xpath=..'), 'background-color'), `${choice} backdrop`).toBe(DARK_BACKDROP);
      near(await frameColour(page, dialog), FRAME_AT_REST[mark]!, `${choice} frame at rest`);
      await closeDialog(page);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('popup content fills', () => {
  // ThemeTokens `--popup-inner-fill`, Dialog: in Light no card, row, field or neutral button of a popup is solid white
  test('in Light no element inside Settings, New session, Resume Session or the running-elsewhere warning paints solid white', async ({ page }) => {
    await mockPastSessions(page);
    await page.goto('/');
    await choose(page, 'Light', 'light');

    const settings = await openSettings(page);
    for (const tab of await settings.getByRole('tab').all()) {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      // The "Light" card of Appearance previews the Light theme with its own fixed colours.
      const preview = (await settings.getByRole('radio', { name: 'Light', exact: true }).count()) > 0 ? cardOf(settings.getByRole('radio', { name: 'Light', exact: true })) : null;
      if (preview) await preview.evaluate((el) => el.setAttribute('data-test-preview', ''));
      expect(await solidWhite(settings, preview ? '[data-test-preview]' : null), `Settings, ${await tab.textContent()}`).toEqual([]);
    }
    for (const token of INNER_TOKENS) expect(await colour(page, `var(${token})`, settings), `${token} inside Settings`).toBe(INNER_FILL);
    const close = settings.getByRole('button', { name: 'Close', exact: true });
    await page.mouse.move(0, 0);
    expect(await style(close, 'background-color'), '"Close" is the soft tint').toBe(INNER_FILL);
    await closeDialog(page);

    await rail(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
    const chooser = newSessionDialog(page);
    await expect(chooser).toBeVisible();
    await pageSettled(page);
    await page.mouse.move(0, 0);
    expect(await solidWhite(chooser), 'New session').toEqual([]);
    expect(await style(chooser.getByRole('button', { name: 'Cancel', exact: true }), 'background-color'), '"Cancel" is the soft tint').toBe(INNER_FILL);
    // The primary action keeps its accent fill.
    expect(await style(chooser.getByRole('button', { name: 'Start Session', exact: true }), 'background-color')).toBe(await colour(page, 'var(--accent-primary)'));
    await closeDialog(page);

    const resume = await openResume(page);
    await page.mouse.move(0, 0);
    expect(await solidWhite(resume), 'Resume Session').toEqual([]);
    await resume.getByRole('radio', { name: 'Past session a1', exact: true }).click();
    await resume.getByRole('button', { name: 'Resume', exact: true }).click();
    const warning = page.getByRole('alertdialog', { name: 'Session Running in a Terminal' });
    await expect(warning).toBeVisible();
    await pageSettled(page);
    await page.mouse.move(0, 0);
    expect(await solidWhite(warning), 'running-elsewhere warning').toEqual([]);
  });

  // plan-cool_slate_light/REQ-13: Dark and Dark Blue keep the fills of popup content
  test('in Dark and Dark Blue the card, raised and field fills inside a popup are those of the page', async ({ page }) => {
    await page.goto('/');
    for (const [choice, mark] of THEMES.slice(1)) {
      await choose(page, choice, mark);
      const dialog = await openSettings(page);
      for (const token of INNER_TOKENS) expect(await colour(page, `var(${token})`, dialog), `${choice} ${token}`).toBe(await colour(page, `var(${token})`));
      await closeDialog(page);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('Resume Session headings', () => {
  // ResumeDialog: the sticky folder heading has no background, only the glass blur, and at rest looks like the frame
  test('the folder headings have no fill, only the glass blur, and at rest show the frame colour, in Light, Dark and Dark Blue', async ({ page }) => {
    await mockPastSessions(page);
    await page.goto('/');
    for (const [choice, mark] of THEMES) {
      await choose(page, choice, mark);
      const dialog = await openResume(page);
      const headings = dialog.locator('.dialog-section-heading');
      await expect(headings).toHaveCount(2);
      const blur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--popup-glass-blur').trim());
      for (const heading of await headings.all()) {
        expect(await style(heading, 'background-color'), `${choice} heading background`).toBe('rgba(0, 0, 0, 0)');
        expect(await style(heading, 'backdrop-filter'), `${choice} heading blur`).toBe(`blur(${blur})`);
        expect(await style(heading, 'position'), `${choice} heading sticks`).toBe('sticky');
      }
      // At rest nothing scrolls under the first heading: it shows the frame colour.
      await page.mouse.move(0, 0);
      const frame = await frameColour(page, dialog);
      const first = await boxOf(headings.first());
      const text = await boxOf(headings.first().getByText('/srv/projects/a', { exact: true }));
      // The empty part of the heading, on the wider side of its text.
      const leftGap = text.x - first.x;
      const rightGap = first.x + first.width - (text.x + text.width);
      const x = leftGap > rightGap ? first.x + 1 : text.x + text.width + 2;
      const heading = await dominant(page, { x, y: first.y + 1, width: Math.max(leftGap, rightGap) - 3, height: first.height - 2 });
      near(heading, frame, `${choice} heading vs frame`, 3);
      await closeDialog(page);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('New session lists', () => {
  // FolderChooser "Folders": its rows are the same ListStyles card as the "Recent" rows, in every theme
  test('a "Folders" row and a "Recent" row have the same fill, border, radius, padding and gap in Light and Dark', async ({ page }) => {
    await mockPastSessions(page);
    await page.goto('/');
    const look = (row: Locator) =>
      row.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fill: s.backgroundColor,
          border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          radius: s.borderTopLeftRadius,
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
        };
      });
    const gap = async (rows: Locator) => {
      const first = await boxOf(rows.nth(0));
      const second = await boxOf(rows.nth(1));
      return Math.round(second.y - (first.y + first.height));
    };
    for (const [choice, mark] of [THEMES[0]!, THEMES[1]!]) {
      await choose(page, choice, mark);
      await rail(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
      const chooser = newSessionDialog(page);
      await expect(chooser).toBeVisible();
      const recent = chooser.getByRole('radiogroup', { name: 'Recent Projects' }).locator('.list-card');
      const folders = chooser.locator('button.list-card');
      await expect(recent).toHaveCount(2);
      await expect.poll(() => folders.count(), { message: `${choice}: the folder listing` }).toBeGreaterThan(1);
      await pageSettled(page);
      await page.mouse.move(0, 0);
      await expect(chooser.getByRole('radio', { checked: true })).toHaveCount(0);
      const recentLook = await look(recent.first());
      expect(recentLook.padding, `${choice}: "Recent" padding`).toBe('6px 10px 6px 10px');
      expect(await look(folders.first()), `${choice}: "Folders" row vs "Recent" row`).toEqual(recentLook);
      expect(await gap(recent), `${choice}: "Recent" gap`).toBe(6);
      expect(await gap(folders), `${choice}: "Folders" gap`).toBe(6);
      await closeDialog(page);
    }
  });
});
