// e2e of plan-mac_title_bar, batch title-bar, in the browser: the drag areas of the TopBar, the Dialog and the StartupPage.
// A fake `window.desktopBridge` makes the page behave as in the desktop window. The window manager's drag and double click
// are not observable here: the tests check the `-webkit-app-region` areas that Electron hands to it.
import { type Page, expect, test } from '@playwright/test';
import { startupPageUrl } from '../src/desktop/startup-page.js';

type Region = 'drag' | 'no-drag' | 'none';

const topBar = (page: Page) => page.getByRole('banner');
const newSessionDialog = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });

async function installFakeBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.assign(window, { desktopBridge: { reportOpenSession: () => {}, onOpenSession: () => () => {} } });
  });
}

/**
 * The window area at a point, as Chromium builds it for Electron: elements in document order, each `drag` adds its box,
 * each `no-drag` removes it, so the last element that declares a value over the point wins.
 */
function regionAt(page: Page, x: number, y: number): Promise<Region> {
  return page.evaluate(
    ([px, py]) => {
      let region: 'drag' | 'no-drag' | 'none' = 'none';
      for (const element of document.querySelectorAll('*')) {
        const value = getComputedStyle(element).getPropertyValue('-webkit-app-region');
        if (value !== 'drag' && value !== 'no-drag') continue;
        const box = element.getBoundingClientRect();
        if (px >= box.left && px < box.right && py >= box.top && py < box.bottom) region = value;
      }
      return region;
    },
    [x, y] as const,
  );
}

/** The centre and the four corners, 2 px inside, of a box. */
function pointsOf(box: { x: number; y: number; width: number; height: number }): [number, number][] {
  const [left, top, right, bottom] = [box.x + 2, box.y + 2, box.x + box.width - 2, box.y + box.height - 2];
  return [[box.x + box.width / 2, box.y + box.height / 2], [left, top], [right, top], [left, bottom], [right, bottom]];
}

async function regionsOver(page: Page, box: { x: number; y: number; width: number; height: number } | null): Promise<Region[]> {
  expect(box, 'element is rendered').not.toBeNull();
  return Promise.all(pointsOf(box!).map(([x, y]) => regionAt(page, x, y)));
}

/** The controls of the top bar: every element a user can click or type into. */
const controlsOf = (page: Page) => topBar(page).locator('button, a, input, select, textarea, [role="button"], [role="switch"], [tabindex]');

test.describe('TopBar in the desktop window', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBridge(page);
  });

  // REQ-6, TopBar "Desktop window": the logo, the brand and the space between the two ends are a drag area
  test('the bar is a drag area over the logo, the brand and the space between its two ends', async ({ page }) => {
    await page.goto('/');
    const bar = await topBar(page).boundingBox();
    expect(bar).not.toBeNull();
    expect(await regionsOver(page, await topBar(page).getByText('VX', { exact: true }).boundingBox())).toEqual(Array(5).fill('drag'));
    expect(await regionsOver(page, await topBar(page).getByText('Vexel', { exact: true }).boundingBox())).toEqual(Array(5).fill('drag'));
    expect(await regionsOver(page, await topBar(page).getByText('for Claude', { exact: true }).boundingBox())).toEqual(Array(5).fill('drag'));
    expect(await regionAt(page, bar!.x + bar!.width / 2, bar!.y + bar!.height / 2), 'the middle of the bar').toBe('drag');
    expect(await regionAt(page, bar!.x + 1, bar!.y + 1), 'the top left corner').toBe('drag');
  });

  // REQ-8, TopBar "Desktop window": every control is out of the drag area, over all of its box
  test('the theme switch, "New Session" and every other control of the bar are outside the drag area', async ({ page }) => {
    await page.goto('/');
    const controls = await controlsOf(page).all();
    expect(controls.length).toBeGreaterThanOrEqual(2);
    for (const control of controls) {
      const name = (await control.getAttribute('aria-label')) ?? (await control.innerText());
      expect(await regionsOver(page, await control.boundingBox()), name).toEqual(Array(5).fill('no-drag'));
    }
  });

  // REQ-8 — scenario "The controls of the top bar do not move the window": the controls still act
  test('a click and a double click on "New Session" open the dialog; a click on the theme switch changes the theme', async ({ page }) => {
    await page.goto('/');
    const newSession = topBar(page).getByRole('button', { name: 'New Session', exact: true });
    await newSession.click();
    await expect(newSessionDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(newSessionDialog(page)).toHaveCount(0);
    await newSession.dblclick();
    await expect(newSessionDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');

    const theme = await page.locator('html').getAttribute('data-theme');
    await topBar(page).getByRole('button', { name: 'Dark theme', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', theme ?? '');
  });

  // REQ-9, TopBar rule: an empty area to drag at every width, also when the window is narrow
  for (const width of [1280, 800, 560, 400, 320]) {
    test(`at ${width} px the brand is still a drag area inside the window`, async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      await page.goto('/');
      const brand = await topBar(page).getByText('Vexel', { exact: true }).boundingBox();
      expect(brand).not.toBeNull();
      const [x, y] = [brand!.x + brand!.width / 2, brand!.y + brand!.height / 2];
      expect(x, 'the brand is inside the window').toBeGreaterThan(0);
      expect(x).toBeLessThan(width);
      expect(await regionAt(page, x, y)).toBe('drag');
    });
  }

  // REQ-12, REQ-13, TopBar rule: the bar keeps the theme tokens, and changes in the same frame as the page
  test('the bar is dark in the dark theme, light in the light theme, and changes in the same frame as the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
    const colours = () =>
      page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.color = 'var(--bg-surface-2)';
        document.body.append(probe);
        const token = getComputedStyle(probe).color;
        probe.remove();
        return { bar: getComputedStyle(document.querySelector('header')!).backgroundColor, token };
      });
    const luminance = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const dark = await colours();
    expect(dark.bar).toBe(dark.token);
    expect(luminance(dark.bar), 'dark bar').toBeLessThan(80);

    // Frames, after the click, until the bar and the page canvas reach their light colours.
    const frames = await page.evaluate(async () => {
      const bar = document.querySelector('header')!;
      const canvasOf = () => getComputedStyle(document.body).backgroundColor;
      const startCanvas = canvasOf();
      const startBar = getComputedStyle(bar).backgroundColor;
      (document.querySelector('header button[aria-label="Dark theme"]') as HTMLButtonElement).click();
      const seen: { bar: boolean; canvas: boolean }[] = [];
      for (let frame = 0; frame < 30; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        seen.push({ bar: getComputedStyle(bar).backgroundColor !== startBar, canvas: canvasOf() !== startCanvas });
      }
      return seen;
    });
    expect(frames.findIndex((frame) => frame.bar), 'the bar changes').toBeGreaterThanOrEqual(0);
    expect(frames.findIndex((frame) => frame.bar), 'the bar and the page change in the same frame').toBe(frames.findIndex((frame) => frame.canvas));

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const light = await colours();
    expect(light.bar).toBe(light.token);
    expect(luminance(light.bar), 'light bar').toBeGreaterThan(180);
  });
});

test.describe('Dialog in the desktop window', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBridge(page);
  });

  // REQ-11, Dialog rule: the backdrop leaves the drag area of the top bar, the frame is never a drag area
  test('with a dialog open the brand is still a drag area and the dialog frame is not', async ({ page }) => {
    await page.goto('/');
    const brand = await topBar(page).getByText('Vexel', { exact: true }).boundingBox();
    await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
    await expect(newSessionDialog(page)).toBeVisible();
    expect(await regionAt(page, brand!.x + brand!.width / 2, brand!.y + brand!.height / 2)).toBe('drag');
    expect(await regionsOver(page, await newSessionDialog(page).boundingBox())).toEqual(Array(5).fill('no-drag'));
  });

  // REQ-8, REQ-11, Dialog rule: a frame that covers the top bar keeps its clicks there
  test('a dialog frame taller than the window, over the top bar, is outside the drag area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 260 });
    await page.goto('/');
    await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
    const frame = await newSessionDialog(page).boundingBox();
    const bar = await topBar(page).boundingBox();
    expect(frame!.y, 'the frame covers part of the top bar').toBeLessThan(bar!.y + bar!.height - 4);
    const x = frame!.x + frame!.width / 2;
    expect(await regionAt(page, x, frame!.y + 2)).toBe('no-drag');
    expect(await regionAt(page, x, Math.min(bar!.y + bar!.height - 2, frame!.y + frame!.height - 2))).toBe('no-drag');
  });
});

// REQ-14, TopBar "Browser": with no desktop bridge the page declares no drag area
test('in the browser no element of the page is a drag area', async ({ page }) => {
  await page.goto('/');
  await expect(topBar(page)).toBeVisible();
  await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
  await expect(newSessionDialog(page)).toBeVisible();
  const dragging = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region') === 'drag').length,
  );
  expect(dragging).toBe(0);
});

test.describe('StartupPage title bar', () => {
  // REQ-10, StartupPage "Shows": an empty 48 px bar across the top, all of it a drag area, in the light top bar colours
  for (const state of [{ kind: 'loading' as const }, { kind: 'error' as const, outputLines: ['first line', 'Backend exited with code 1.'] }]) {
    test(`${state.kind} state: an empty light 48 px bar across the top, all of it a drag area`, async ({ page }) => {
      for (const width of [1280, 420]) {
        await page.setViewportSize({ width, height: 700 });
        await page.goto(startupPageUrl(state));
        for (const y of [1, 24, 47]) {
          for (const x of [1, width / 2, width - 1]) expect(await regionAt(page, x, y), `${width} px, at ${x}, ${y}`).toBe('drag');
        }
        expect(await regionAt(page, width / 2, 49), 'below the bar').not.toBe('drag');

        const bar = await page.evaluate(() => {
          const element = [...document.querySelectorAll('body *')].find((e) => getComputedStyle(e).getPropertyValue('-webkit-app-region') === 'drag')!;
          const s = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            box: [box.left, box.top, box.width, box.height],
            text: element.textContent,
            children: element.children.length,
            background: s.backgroundColor,
            border: [s.borderBottomWidth, s.borderBottomStyle, s.borderBottomColor],
          };
        });
        expect(bar.box).toEqual([0, 0, width, 48]);
        expect(bar.text, 'the bar is empty').toBe('');
        expect(bar.children).toBe(0);
        expect(bar.background).toBe('rgb(239, 234, 224)');
        expect(bar.border).toEqual(['1px', 'solid', 'rgba(28, 25, 23, 0.08)']);

        const message = page.getByText(state.kind === 'loading' ? 'Starting the backend…' : 'The backend could not start.', { exact: true });
        await expect(message).toBeVisible();
        expect((await message.boundingBox())!.y, 'the message is below the bar').toBeGreaterThanOrEqual(48);
      }
    });
  }
});
