// e2e of plan-ui_restyle, batch top-bar: the 44 px top bar with no "New Session", and the two ways left to start a session.
import { type Page, expect, test } from '@playwright/test';

const LOOK_KEY = 'ai-client.look';
const BAR_CONTROLS = ['Keyboard Shortcuts', 'Dark theme', 'Windows 11 look', 'Plan Usage'];

const topBar = (page: Page) => page.getByRole('banner');
const rail = (page: Page) => page.getByRole('navigation', { name: 'Main Navigation' });
const list = (page: Page) => page.getByRole('region', { name: 'Session List' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'New Claude Code Session' });

async function loadPage(page: Page, look: 'vexel' | 'windows11' = 'vexel'): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [LOOK_KEY, look] as const);
  await page.goto('/');
  await expect(list(page)).toBeVisible();
  await expect(topBar(page)).toBeVisible();
}

for (const look of ['vexel', 'windows11'] as const) {
  // plan-ui_restyle/REQ-1
  test(`${look} look: the top bar is 44 px high`, async ({ page }) => {
    await loadPage(page, look);
    const bar = (await topBar(page).boundingBox())!;
    expect(bar.height).toBeCloseTo(44, 0);
    const railBox = (await rail(page).boundingBox())!;
    expect(railBox.y, 'the rail starts right under the bar').toBeCloseTo(bar.y + 44, 0);
  });

  // plan-ui_restyle/REQ-2
  test(`${look} look: the top bar shows no "New Session" button and only its four controls`, async ({ page }) => {
    await loadPage(page, look);
    await expect(topBar(page).getByRole('button', { name: 'New Session' })).toHaveCount(0);
    await expect(topBar(page)).not.toContainText('New Session');
    const names = await topBar(page)
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
    expect(names).toEqual(BAR_CONTROLS);
  });
}

// plan-ui_restyle/REQ-3 — scenario "The top bar is lower and has no "New Session" button"
test('the rail "+" opens the new-session dialog', async ({ page }) => {
  await loadPage(page);
  await rail(page).getByRole('button', { name: 'New Claude Code Session', exact: true }).click();
  await expect(chooser(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chooser(page)).toHaveCount(0);
});

// plan-ui_restyle/REQ-3
test('the new-session shortcut Alt+N opens the new-session dialog', async ({ page }) => {
  await loadPage(page);
  await page.keyboard.press('Alt+KeyN');
  await expect(chooser(page)).toBeVisible();
});
