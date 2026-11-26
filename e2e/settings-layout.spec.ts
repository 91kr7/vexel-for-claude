// e2e of plan-settings_dialog, batch update-check: the menus of the settings popup and its steady layout.
import { type Locator, type Page, expect, test } from '@playwright/test';
import { settled } from './motion';
import { cardOf, settingsButton, settingsPopup } from './settings';

const MENUS = ['Appearance', 'Shortcuts', 'Processes', 'Updates'] as const;

const menu = (page: Page) => settingsPopup(page).getByRole('tablist', { name: 'Settings sections' });
const menuItem = (page: Page, name: string) => menu(page).getByRole('tab', { name, exact: true });
const shownPanel = (page: Page) => settingsPopup(page).getByRole('tabpanel');
const shortcutList = (page: Page) => settingsPopup(page).getByRole('region', { name: 'Shortcut List' });
const card = (page: Page, name: string) => cardOf(settingsPopup(page).getByRole('radio', { name, exact: true }));

async function openSettings(page: Page): Promise<void> {
  await page.goto('/');
  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Border colour and font weight of a card, as the user sees them. */
const markOf = (card: Locator) =>
  card.evaluate((element) => {
    const style = getComputedStyle(element);
    const label = [...element.querySelectorAll('span')].find((span) => span.children.length === 0 && span.textContent?.trim() === element.textContent?.trim());
    return { border: style.borderTopColor, weight: Number(getComputedStyle(label ?? element).fontWeight) };
  });

test.describe('at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // plan-settings_dialog/REQ-53, REQ-54, REQ-55, plan-app_processes/REQ-1 — scenario "The settings popup shows three menus at a steady size"
  test('REQ-53, REQ-54, REQ-55: four menus in a vertical list on the left, the chosen one on the right, at the same popup size', async ({ page }) => {
    await openSettings(page);
    await expect(menu(page).getByRole('tab')).toHaveText([...MENUS]);
    await expect(menuItem(page, 'Appearance')).toHaveAttribute('aria-selected', 'true');
    const items = await Promise.all(MENUS.map((name) => box(menuItem(page, name))));
    for (let index = 1; index < items.length; index++) {
      expect(items[index]!.y, 'the menu is vertical').toBeGreaterThan(items[index - 1]!.y);
      expect(Math.abs(items[index]!.x - items[0]!.x)).toBeLessThanOrEqual(1);
    }
    const sizes = [];
    for (const name of MENUS) {
      await menuItem(page, name).click();
      await expect(menuItem(page, name)).toHaveAttribute('aria-selected', 'true');
      await expect(shownPanel(page)).toHaveCount(1);
      const panel = await box(shownPanel(page));
      const list = await box(menu(page));
      expect(panel.x, `the ${name} menu shows on the right of the list`).toBeGreaterThanOrEqual(list.x + list.width - 1);
      sizes.push(await box(settingsPopup(page)));
    }
    for (const size of sizes) {
      expect(Math.abs(size.width - sizes[0]!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(size.height - sizes[0]!.height)).toBeLessThanOrEqual(1);
    }
  });

  // plan-settings_dialog/REQ-53: "Appearance" holds the theme section, then the look section
  test('REQ-53: "Appearance" shows the "Theme" group, then the "Window Look" group', async ({ page }) => {
    await openSettings(page);
    const theme = await box(shownPanel(page).getByRole('group', { name: 'Theme' }));
    const look = await box(shownPanel(page).getByRole('group', { name: 'Window Look' }));
    expect(look.y).toBeGreaterThan(theme.y);
  });

  // plan-settings_dialog/REQ-57: each choice is a card, the active one marked; the mark follows the choice
  test('REQ-57: the theme and look choices are cards, and the active card is marked', async ({ page }) => {
    await openSettings(page);
    const dark = await markOf(card(page, 'Dark'));
    const light = await markOf(card(page, 'Light'));
    expect(dark.border, 'the active card has another border').not.toBe(light.border);
    expect(dark.weight, 'the active card has bolder text').toBeGreaterThan(light.weight);
    const mac = await markOf(card(page, 'macOS'));
    const windows = await markOf(card(page, 'Windows 11'));
    expect(mac.border).toBe(dark.border);
    expect(windows.border).toBe(light.border);

    await cardOf(settingsPopup(page).getByRole('radio', { name: 'Light', exact: true })).click();
    await expect.poll(async () => (await markOf(card(page, 'Light'))).weight).toBeGreaterThan((await markOf(card(page, 'Dark'))).weight);
    const cards = await Promise.all(['Light', 'Dark'].map((name) => box(card(page, name))));
    expect(Math.abs(cards[0]!.y - cards[1]!.y), 'the cards sit side by side').toBeLessThanOrEqual(1);
    expect(cards[1]!.x).toBeGreaterThan(cards[0]!.x + cards[0]!.width - 1);
  });

  // plan-settings_dialog/REQ-58: each row on one line: the action on the left, then the keys and the row actions
  test('REQ-58: every shortcut row takes one line, with the action on the left and the keys and buttons on its right', async ({ page }) => {
    await openSettings(page);
    await menuItem(page, 'Shortcuts').click();
    const rows = await shortcutList(page)
      .locator('li')
      .evaluateAll((items) =>
        items.map((item) => {
          const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
          let actionNode: Node | null = null;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent?.trim() && !node.parentElement?.closest('kbd, button')) {
              actionNode = node;
              break;
            }
          }
          const range = document.createRange();
          range.selectNodeContents(actionNode!);
          const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
          const action = range.getBoundingClientRect();
          const others = [...item.querySelectorAll('kbd, button')].map((element) => element.getBoundingClientRect());
          return {
            action: actionNode!.textContent!.trim(),
            actionLines: lines.size,
            sameLine: others.every((rect) => rect.top < action.bottom && rect.bottom > action.top),
            onTheRight: others.every((rect) => rect.left >= action.right),
          };
        }),
      );
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect(row.actionLines, `${row.action}: the action fits on one line`).toBe(1);
      expect(row.sameLine, `${row.action}: keys and buttons on the line of the action`).toBe(true);
      expect(row.onTheRight, `${row.action}: keys and buttons on the right of the action`).toBe(true);
    }
  });

  // plan-settings_dialog/REQ-59: "Restore All" in the header, outside the list that scrolls
  test('REQ-59: "Restore All" sits above the "Shortcut List" and stays in place while the list scrolls', async ({ page }) => {
    await openSettings(page);
    await menuItem(page, 'Shortcuts').click();
    // The new section rises in (plan-ui_transitions/REQ-24): it is measured at rest.
    await settled(settingsPopup(page), true);
    const restoreAll = settingsPopup(page).getByRole('button', { name: 'Restore All', exact: true });
    const inList = await shortcutList(page).evaluate((list, button) => list.contains(button), await restoreAll.elementHandle());
    expect(inList).toBe(false);
    const before = await box(restoreAll);
    expect(before.y + before.height).toBeLessThanOrEqual((await box(shortcutList(page))).y + 1);
    await shortcutList(page).evaluate((list) => (list.scrollTop = list.scrollHeight));
    expect(await box(restoreAll)).toEqual(before);
    await expect(restoreAll).toBeInViewport();
  });

  // plan-settings_dialog/REQ-60: one card holds the installed version, the button and the result
  test('REQ-60: "Updates" shows the installed version, the button and the result in one card', async ({ page }) => {
    await openSettings(page);
    await menuItem(page, 'Updates').click();
    const card = shownPanel(page).getByRole('region', { name: 'Updates', exact: true });
    await expect(card.getByText(/^Installed version: v\d+\.\d+\.\d+$/)).toBeVisible();
    await card.getByRole('button', { name: 'Check for Updates' }).click();
    await expect(card.getByRole('alert')).toHaveText('Could not check for updates. Try again later.');
  });
});

// plan-settings_dialog/REQ-56 — scenario "The settings popup shows three menus at a steady size", small window
for (const viewport of [
  { width: 900, height: 600 },
  { width: 640, height: 420 },
]) {
  test(`REQ-55, REQ-56: at ${viewport.width} × ${viewport.height} the popup fits, keeps its size and only the right part scrolls`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSettings(page);
    // The box zooms in on opening (MotionTokens): REQ-55 and REQ-56 are about its size at rest.
    await settled(page.locator('.modal-backdrop'), true);
    const sizes = [];
    for (const name of MENUS) {
      await menuItem(page, name).click();
      const popup = await box(settingsPopup(page));
      expect(popup.x).toBeGreaterThanOrEqual(0);
      expect(popup.y).toBeGreaterThanOrEqual(0);
      expect(popup.x + popup.width, `${name}: the popup fits the window width`).toBeLessThanOrEqual(viewport.width);
      expect(popup.y + popup.height, `${name}: the popup fits the window height`).toBeLessThanOrEqual(viewport.height);
      const scrolls = await settingsPopup(page).evaluate((dialog) => dialog.scrollHeight > dialog.clientHeight + 1);
      expect(scrolls, `${name}: the popup itself does not scroll`).toBe(false);
      sizes.push(popup);
    }
    for (const size of sizes) {
      expect(Math.abs(size.width - sizes[0]!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(size.height - sizes[0]!.height)).toBeLessThanOrEqual(1);
    }
    await menuItem(page, 'Shortcuts').click();
    const list = shortcutList(page);
    expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight), 'the shortcut list scrolls').toBe(true);
    await list.evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect(list.getByRole('button', { name: 'Restore Default: Shortcut settings', exact: true })).toBeInViewport();
    await expect(settingsPopup(page).getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  });
}
