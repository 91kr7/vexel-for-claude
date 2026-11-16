// Theme and look choices through the settings popup, for the specs that need one of them.
import { type Locator, type Page, expect } from '@playwright/test';

export const settingsButton = (page: Page) =>
  page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('button', { name: 'Settings', exact: true });
export const settingsPopup = (page: Page) => page.getByRole('dialog', { name: 'Settings', exact: true });

/** The card of a theme or look radio: the user clicks the card, the radio inside it is not a target of its own. */
export const cardOf = (radio: Locator) => radio.locator('xpath=ancestor::label[1]');

export type SettingsChoice = 'Light' | 'Dark' | 'macOS' | 'Windows 11';

/** Opens the settings popup, chooses `choice` in its tab and closes the popup. */
export async function chooseInSettings(page: Page, choice: SettingsChoice): Promise<void> {
  await settingsButton(page).click();
  const popup = settingsPopup(page);
  await expect(popup).toBeVisible();
  await popup.getByRole('tab', { name: 'Appearance', exact: true }).click();
  await cardOf(popup.getByRole('radio', { name: choice, exact: true })).click();
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
