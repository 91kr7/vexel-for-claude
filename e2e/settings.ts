// Theme and look choices through the settings popup, for the specs that need one of them.
import { type Page, expect } from '@playwright/test';

export const settingsButton = (page: Page) =>
  page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Settings', exact: true });
export const settingsPopup = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });

export type SettingsChoice = 'Light' | 'Dark' | 'macOS' | 'Windows 11';

/** Opens the settings popup, chooses `choice` in its tab and closes the popup. */
export async function chooseInSettings(page: Page, choice: SettingsChoice): Promise<void> {
  await settingsButton(page).click();
  const popup = settingsPopup(page);
  await expect(popup).toBeVisible();
  await popup.getByRole('tab', { name: choice === 'Light' || choice === 'Dark' ? 'Theme' : 'Window Look', exact: true }).click();
  await popup.getByRole('radio', { name: choice, exact: true }).check();
  await popup.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(popup).toHaveCount(0);
}

/** The other theme than the active one: what the old top bar switch gave with one press. */
export async function toggleThemeInSettings(page: Page): Promise<void> {
  const theme = await page.locator('html').getAttribute('data-theme');
  await chooseInSettings(page, theme === 'light' ? 'Dark' : 'Light');
}

/** The other look than the active one. */
export async function toggleLookInSettings(page: Page): Promise<void> {
  const look = await page.locator('html').getAttribute('data-look');
  await chooseInSettings(page, look === 'windows11' ? 'macOS' : 'Windows 11');
}
