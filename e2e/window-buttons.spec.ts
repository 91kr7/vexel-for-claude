// e2e of plan-mac_title_bar, batch window-buttons, in the browser: WindowButtons in the TopBar and on the StartupPage.
// A fake `window.desktopBridge` records the window requests and plays the maximized state; Electron is checked in e2e/desktop-window.spec.ts.
import { type Locator, type Page, expect, test } from '@playwright/test';
import { startupPageUrl } from '../src/desktop/startup-page.js';

interface FakeOptions {
  maximized?: boolean;
  answerDelayMs?: number;
  withWindowFunctions?: boolean;
}

const RED = 'rgb(255, 95, 87)';
const YELLOW = 'rgb(254, 188, 46)';
const GREEN = 'rgb(40, 200, 64)';

const topBar = (page: Page) => page.getByRole('banner');
const newSessionDialog = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });

async function installFakeBridge(page: Page, options: FakeOptions = {}): Promise<void> {
  await page.addInitScript(({ maximized = false, answerDelayMs = 0, withWindowFunctions = true }: FakeOptions) => {
    const calls: string[] = [];
    let listeners: ((maximized: boolean) => void)[] = [];
    const windowFunctions = {
      closeWindow: () => calls.push('close'),
      minimizeWindow: () => calls.push('minimize'),
      toggleMaximizeWindow: () => calls.push('toggle-maximize'),
      isWindowMaximized: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(maximized), answerDelayMs)),
      onWindowMaximizedChange: (listener: (maximized: boolean) => void) => {
        listeners.push(listener);
        return () => {
          listeners = listeners.filter((other) => other !== listener);
        };
      },
    };
    Object.assign(window, {
      windowCalls: calls,
      emitMaximized: (value: boolean) => listeners.forEach((listener) => listener(value)),
      desktopBridge: { reportOpenSession: () => {}, onOpenSession: () => () => {}, ...(withWindowFunctions ? windowFunctions : {}) },
    });
  }, options);
}

/** The markup of the symbol the button paints, with the pointer over it. */
async function shownSymbol(button: Locator): Promise<string> {
  await button.hover();
  return button.locator('svg:visible').innerHTML();
}

const windowCalls = (page: Page) => page.evaluate(() => (window as unknown as { windowCalls: string[] }).windowCalls);
const emitMaximized = (page: Page, value: boolean) => page.evaluate((v) => (window as unknown as { emitMaximized: (v: boolean) => void }).emitMaximized(v), value);

function windowButtons(scope: Page | Locator) {
  return {
    close: scope.getByRole('button', { name: 'Close', exact: true }),
    minimize: scope.getByRole('button', { name: 'Minimize', exact: true }),
    maximize: scope.getByRole('button', { name: 'Maximize', exact: true }),
    restore: scope.getByRole('button', { name: 'Restore', exact: true }),
  };
}

/** Whether each button paints its symbol: the svg and every ancestor up to the button are displayed, visible and not transparent. */
function symbolsShown(buttons: Locator[]): Promise<boolean[]> {
  return Promise.all(
    buttons.map((button) =>
      button.evaluate((element) =>
        [...element.querySelectorAll('svg')].some((symbol) => {
          for (let node: Element | null = symbol; node !== null; node = node === element ? null : node.parentElement) {
            const s = getComputedStyle(node);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          }
          const box = symbol.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        }),
      ),
    ),
  );
}

/** The window area at a point, as Chromium builds it for Electron: the last element in document order that declares a value over the point wins. */
function regionAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([px, py]) => {
      let region = 'none';
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

/** Presses Tab until the target has the focus, as a keyboard user does. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 30 && !(await target.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(target, 'reached with Tab').toBeFocused();
}

async function boxes(buttons: Locator[]) {
  return Promise.all(buttons.map(async (button) => (await button.boundingBox())!));
}

/** The look shared by the TopBar and the StartupPage: three 12 px circles, 8 px apart, red, yellow, green, left to right. */
async function expectMacLook(buttons: Locator[]): Promise<void> {
  const [close, minimize, maximize] = await boxes(buttons);
  for (const box of [close!, minimize!, maximize!]) {
    expect(box.width).toBeCloseTo(12, 0);
    expect(box.height).toBeCloseTo(12, 0);
  }
  expect(minimize!.x - (close!.x + close!.width), 'gap red-yellow').toBeCloseTo(8, 0);
  expect(maximize!.x - (minimize!.x + minimize!.width), 'gap yellow-green').toBeCloseTo(8, 0);
  expect(Math.abs(close!.y - maximize!.y), 'one row').toBeLessThan(1);
  const looks = await Promise.all(buttons.map((b) => b.evaluate((e) => ({ background: getComputedStyle(e).backgroundColor, radius: getComputedStyle(e).borderRadius }))));
  expect(looks.map((look) => look.background)).toEqual([RED, YELLOW, GREEN]);
  for (const look of looks) expect(['50%', '6px', '9999px', '999px', '100%']).toContain(look.radius);
}

/** Symbol colour blended on each button fill, and its contrast ratio. */
function symbolContrasts(buttons: Locator[]): Promise<{ fill: string; symbol: string; ratio: number }[]> {
  return Promise.all(
    buttons.map((button) =>
      button.evaluate((element) => {
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const fill = getComputedStyle(element).backgroundColor;
        const symbol = getComputedStyle(element.querySelector('svg')!).color;
        const [fr, fg, fb] = parse(fill);
        const [sr, sg, sb, sa = 1] = parse(symbol);
        const blend = [sr! * sa + fr! * (1 - sa), sg! * sa + fg! * (1 - sa), sb! * sa + fb! * (1 - sa)];
        const lum = ([r, g, b]: number[]) =>
          [r!, g!, b!].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
        const [a, b] = [lum([fr!, fg!, fb!]), lum(blend)];
        return { fill, symbol, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      }),
    ),
  );
}

test.describe('WindowButtons in the desktop top bar', () => {
  // REQ-15, REQ-27, WindowButtons "Shows": red, yellow, green circles at the left end of the bar, before the logo
  test('the bar starts with "Close", "Minimize" and "Maximize": red, yellow, green 12 px circles 8 px apart, before the logo', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    await expect(close).toBeVisible();
    await expectMacLook([close, minimize, maximize]);
    const logo = (await topBar(page).getByText('VX', { exact: true }).boundingBox())!;
    const green = (await maximize.boundingBox())!;
    expect(green.x + green.width, 'the buttons come before the logo').toBeLessThanOrEqual(logo.x);
    const left = (await close.boundingBox())!.x;
    const controlsLeft = await topBar(page).locator('button, a, input, [role="button"]').evaluateAll((all) => all.map((e) => e.getBoundingClientRect().x));
    expect(Math.min(...controlsLeft), 'no control left of the red button').toBe(left);
  });

  // REQ-16, REQ-17, REQ-18, WindowButtons "Actions": each button asks its window action
  test('red asks to close, yellow to minimize, green to maximize or restore', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    await close.click();
    await minimize.click();
    await maximize.click();
    expect(await windowCalls(page)).toEqual(['close', 'minimize', 'toggle-maximize']);
  });

  // REQ-21, REQ-27, useWindowMaximized: the green button follows the maximized state, by name and symbol
  test('the green button is "Restore" with another symbol while the window is maximized, and follows each change', async ({ page }) => {
    await installFakeBridge(page, { maximized: true });
    await page.goto('/');
    const { maximize, restore } = windowButtons(topBar(page));
    await expect(restore).toBeVisible();
    await expect(maximize).toHaveCount(0);
    const restoreSymbol = await shownSymbol(restore);

    await emitMaximized(page, false);
    await expect(maximize).toBeVisible();
    await expect(restore).toHaveCount(0);
    expect(await shownSymbol(maximize), 'maximize and restore symbols differ').not.toBe(restoreSymbol);

    await emitMaximized(page, true);
    await expect(restore).toBeVisible();
    await restore.click();
    expect(await windowCalls(page)).toEqual(['toggle-maximize']);
  });

  // useWindowMaximized: a change that arrives before the answer of the state question wins over it
  test('a maximized change that arrives before the late state answer wins', async ({ page }) => {
    await installFakeBridge(page, { maximized: false, answerDelayMs: 1500 });
    await page.goto('/');
    const { maximize, restore } = windowButtons(topBar(page));
    await expect(maximize).toBeVisible();
    await emitMaximized(page, true);
    await expect(restore).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(restore).toBeVisible();
  });

  // REQ-19, REQ-20, WindowButtons "Shows": all three symbols with the pointer over the group, gaps included; only colours otherwise
  test('the pointer over any button or gap of the group shows all three symbols; away from it, or with keyboard focus, none', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    const all = [close, minimize, maximize];
    await expect(close).toBeVisible();
    await page.mouse.move(600, 400);
    await expect.poll(() => symbolsShown(all), { message: 'pointer away' }).toEqual([false, false, false]);

    await minimize.hover();
    await expect.poll(() => symbolsShown(all), { message: 'pointer over yellow' }).toEqual([true, true, true]);

    const [red, yellow] = await boxes([close, minimize]);
    await page.mouse.move(600, 400);
    await expect.poll(() => symbolsShown(all)).toEqual([false, false, false]);
    await page.mouse.move(red!.x + red!.width + (yellow!.x - red!.x - red!.width) / 2, red!.y + red!.height / 2);
    await expect.poll(() => symbolsShown(all), { message: 'pointer over the gap red-yellow' }).toEqual([true, true, true]);

    await page.mouse.move(600, 400);
    await tabTo(page, close);
    await page.waitForTimeout(300);
    expect(await symbolsShown(all), 'keyboard focus does not show the symbols').toEqual([false, false, false]);
  });

  // REQ-22, REQ-26, WindowButtons rule: same colours and symbol colour in both themes, the symbols readable on each fill
  test('the colours and the symbol colour are the same in both themes, and the symbols keep a 3:1 contrast on each fill', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    const all = [close, minimize, maximize];
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
    const dark = await symbolContrasts(all);

    await topBar(page).getByRole('button', { name: 'Dark theme', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const light = await symbolContrasts(all);

    expect(dark.map((d) => d.fill)).toEqual([RED, YELLOW, GREEN]);
    expect(light).toEqual(dark);
    for (const { fill, ratio } of dark) expect(ratio, `symbol contrast on ${fill}`).toBeGreaterThanOrEqual(3);
  });

  // REQ-28, WindowButtons "Keyboard": real buttons in the Tab order, with the focus ring of the bar, Enter and Space act
  test('Tab reaches the three buttons with the same focus ring as "New Session"; Enter and Space act; a click keeps the focus where it was', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const bar = topBar(page);
    const { close, minimize, maximize } = windowButtons(bar);
    await expect(close).toBeVisible();
    const ring = (locator: Locator) =>
      locator.evaluate((e) => {
        const s = getComputedStyle(e);
        return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, offset: s.outlineOffset, shadow: s.boxShadow };
      });

    await tabTo(page, close);
    await page.keyboard.press('Tab');
    await expect(minimize).toBeFocused();
    const minimizeRing = await ring(minimize);
    expect(minimizeRing.outline === 'none 0px rgb(0, 0, 0)' && minimizeRing.shadow === 'none', 'a visible focus ring').toBe(false);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(maximize).toBeFocused();
    await page.keyboard.press('Space');
    expect(await windowCalls(page)).toEqual(['minimize', 'toggle-maximize']);

    const newSession = bar.getByRole('button', { name: 'New Session', exact: true });
    await tabTo(page, newSession);
    const newSessionRing = await ring(newSession);
    expect(minimizeRing.outline, 'same ring as "New Session"').toBe(newSessionRing.outline);
    expect(minimizeRing.offset).toBe(newSessionRing.offset);

    await close.click();
    await expect(newSession, 'the click left the focus on "New Session"').toBeFocused();
  });

  // WindowButtons rule: the group, gaps included, is never a drag area
  test('the buttons and the gaps between them are outside the drag area', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    await expect(close).toBeVisible();
    const [red, yellow, green] = await boxes([close, minimize, maximize]);
    const y = red!.y + red!.height / 2;
    const points = [
      red!.x + red!.width / 2,
      (red!.x + red!.width + yellow!.x) / 2,
      yellow!.x + yellow!.width / 2,
      (yellow!.x + yellow!.width + green!.x) / 2,
      green!.x + green!.width / 2,
    ];
    for (const x of points) expect(await regionAt(page, x, y), `at ${x}`).toBe('no-drag');
  });

  // REQ-24, WindowButtons and Dialog rules: above the backdrop and clickable; the dialog keeps the focus and its Tab order
  test('with "New Session" open the green button is on top and works, the dialog stays open with the focus, and Tab never reaches the buttons', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto('/');
    const { close, minimize, maximize } = windowButtons(topBar(page));
    await topBar(page).getByRole('button', { name: 'New Session', exact: true }).click();
    const dialog = newSessionDialog(page);
    await expect(dialog).toBeVisible();

    for (const button of [close, minimize, maximize]) {
      const box = (await button.boundingBox())!;
      const onTop = await button.evaluate((e, [x, y]) => e.contains(document.elementFromPoint(x!, y!)), [box.x + box.width / 2, box.y + box.height / 2]);
      expect(onTop, `${await button.getAttribute('aria-label')} is above the backdrop`).toBe(true);
    }

    await maximize.click();
    expect(await windowCalls(page)).toEqual(['toggle-maximize']);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((e) => e.contains(document.activeElement)), 'the focus stays in the dialog').toBe(true);

    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((e) => e.contains(document.activeElement)), `Tab ${i + 1} stays in the dialog`).toBe(true);
    }
  });
});

// useDesktopBridge contract: a bridge without the window functions leaves the buttons inert, never broken
test('with a desktop bridge that has no window functions the buttons show "Maximize" and a click raises no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installFakeBridge(page, { withWindowFunctions: false });
  await page.goto('/');
  const { close, minimize, maximize } = windowButtons(topBar(page));
  for (const button of [close, minimize, maximize]) {
    await expect(button).toBeVisible();
    await button.click();
  }
  expect(errors).toEqual([]);
});

// REQ-25, TopBar "Browser": no window buttons and no space kept for them
test('in the browser the top bar has no window buttons and the logo sits at its left end', async ({ page }) => {
  await page.goto('/');
  const bar = topBar(page);
  await expect(bar).toBeVisible();
  for (const name of ['Close', 'Minimize', 'Maximize', 'Restore']) await expect(bar.getByRole('button', { name, exact: true })).toHaveCount(0);
  const logo = (await bar.getByText('VX', { exact: true }).boundingBox())!;
  const contentLeft = await bar.evaluate((e) => {
    const s = getComputedStyle(e);
    return e.getBoundingClientRect().x + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
  });
  expect(logo.x, 'the logo is the first thing of the bar').toBeCloseTo(contentLeft, 0);

  await installFakeBridge(page);
  await page.reload();
  const desktopLogo = (await bar.getByText('VX', { exact: true }).boundingBox())!;
  expect(desktopLogo.x - logo.x, 'the desktop window adds the buttons before the logo').toBeGreaterThanOrEqual(12 * 3 + 8 * 2);
});

test.describe('WindowButtons on the StartupPage', () => {
  const states = [{ kind: 'loading' as const }, { kind: 'error' as const, outputLines: ['first line', 'Backend exited with code 1.'] }];

  for (const state of states) {
    // REQ-23, StartupPage "Shows" and "Actions": the three buttons at the left of the bar, outside the drag area, and they act
    test(`${state.kind} state: the three buttons sit 14 px from the left, centred in the bar, outside the drag area, and act`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await installFakeBridge(page);
      await page.goto(startupPageUrl(state));
      const { close, minimize, maximize } = windowButtons(page);
      await expect(close).toBeVisible();
      await expectMacLook([close, minimize, maximize]);
      const [red, yellow, green] = await boxes([close, minimize, maximize]);
      expect(red!.x).toBeCloseTo(14, 0);
      expect(red!.y + red!.height / 2, 'centred in the 48 px bar').toBeCloseTo(24, 0);
      for (const x of [red!.x + 6, (red!.x + 12 + yellow!.x) / 2, yellow!.x + 6, (yellow!.x + 12 + green!.x) / 2, green!.x + 6]) {
        expect(await regionAt(page, x, 24), `at ${x}`).toBe('no-drag');
      }
      expect(await regionAt(page, green!.x + 40, 24), 'the bar right of the buttons').toBe('drag');

      await close.click();
      await minimize.click();
      await maximize.click();
      expect(await windowCalls(page)).toEqual(['close', 'minimize', 'toggle-maximize']);
      expect(errors).toEqual([]);
    });
  }

  // REQ-21, REQ-23, StartupPage "Actions": the green button asks the state at load and follows its changes
  test('the green button is "Restore" when the window is maximized at load and follows each change', async ({ page }) => {
    await installFakeBridge(page, { maximized: true });
    await page.goto(startupPageUrl({ kind: 'loading' }));
    const { maximize, restore } = windowButtons(page);
    await expect(restore).toBeVisible();
    const restoreSymbol = await shownSymbol(restore);
    await emitMaximized(page, false);
    await expect(maximize).toBeVisible();
    await expect(restore).toHaveCount(0);
    expect(await shownSymbol(maximize), 'maximize and restore symbols differ').not.toBe(restoreSymbol);
    await emitMaximized(page, true);
    await expect(restore).toBeVisible();
  });

  // REQ-19, REQ-20, StartupPage "Shows": same hover rule as the WindowButtons
  test('the pointer over the group shows the three symbols; away from it, only the colours', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto(startupPageUrl({ kind: 'loading' }));
    const { close, minimize, maximize } = windowButtons(page);
    const all = [close, minimize, maximize];
    await page.mouse.move(600, 400);
    await expect.poll(() => symbolsShown(all)).toEqual([false, false, false]);
    await maximize.hover();
    await expect.poll(() => symbolsShown(all)).toEqual([true, true, true]);
  });

  // REQ-28, StartupPage "Shows": keyboard focus shows a 2 px #0065ae ring 2 px away
  test('keyboard focus on a button shows the 2 px accent ring 2 px away', async ({ page }) => {
    await installFakeBridge(page);
    await page.goto(startupPageUrl({ kind: 'loading' }));
    const { close } = windowButtons(page);
    await expect(close).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    const ring = await close.evaluate((e) => {
      const s = getComputedStyle(e);
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset];
    });
    expect(ring).toEqual(['solid', '2px', 'rgb(0, 101, 174)', '2px']);
  });

  // StartupPage "Actions": with no bridge the buttons show and do nothing
  test('with no desktop bridge the buttons show and a click raises no error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(startupPageUrl({ kind: 'loading' }));
    const { close, minimize, maximize } = windowButtons(page);
    for (const button of [close, minimize, maximize]) {
      await expect(button).toBeVisible();
      await button.click();
    }
    expect(errors).toEqual([]);
  });
});
