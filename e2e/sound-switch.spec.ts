// e2e of plan-input_sound, batch sound-switch, in the browser. A fake bridge makes the page a desktop window.
// plan-remote_notifications renamed the menu "Sound" to "Notifications" and moved it before "Updates".
// The restart of the desktop app and the notifications with the switch off are in desktop-sound.spec.ts.
import { type Page, expect, test } from '@playwright/test';
import { settingsButton, settingsPopup } from './settings';

const SWITCH = 'Play a sound when a session needs input';

type SoundProbe = { plays: string[]; listeners: number; requestSound(): void };

/** Records each play of an audio element, without playing it, and plays the DesktopBridge preload with `onPlaySound`. */
async function installDesktopPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const plays: string[] = [];
    const listeners = new Set<() => void>();
    const probe: SoundProbe = { plays, listeners: 0, requestSound: () => listeners.forEach((listener) => listener()) };
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      plays.push(this.src);
      return Promise.resolve();
    };
    Object.assign(window, {
      e2eSound: probe,
      desktopBridge: {
        reportOpenSession: () => {},
        onOpenSession: () => () => {},
        getPathForFile: () => '',
        onPlaySound: (listener: () => void) => {
          listeners.add(listener);
          probe.listeners = listeners.size;
          return () => {
            listeners.delete(listener);
            probe.listeners = listeners.size;
          };
        },
      },
    });
  });
}

const plays = (page: Page) => page.evaluate(() => [...(window as unknown as { e2eSound: SoundProbe }).e2eSound.plays]);
const requestSound = (page: Page) => page.evaluate(() => (window as unknown as { e2eSound: SoundProbe }).e2eSound.requestSound());
const listeners = (page: Page) => page.evaluate(() => (window as unknown as { e2eSound: SoundProbe }).e2eSound.listeners);

const tab = (page: Page, name: string) => settingsPopup(page).getByRole('tab', { name, exact: true });
const soundSwitch = (page: Page) => settingsPopup(page).getByRole('switch', { name: SWITCH, exact: true });

async function openDesktopPage(page: Page): Promise<void> {
  await installDesktopPage(page);
  await page.goto('/');
  await expect(settingsButton(page)).toBeVisible();
  await expect.poll(() => listeners(page)).toBe(1);
}

async function openSoundMenu(page: Page): Promise<void> {
  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  await tab(page, 'Notifications').click();
  await expect(soundSwitch(page)).toBeVisible();
}

/** Whether the focused element matches `:focus-visible` and draws an outline or a box-shadow. */
const showsFocusRing = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return element.matches(':focus-visible') && ((style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none');
  });

// Scenario "The user turns the sound off"; plan-input_sound/REQ-10, REQ-11; plan-remote_notifications/REQ-1, REQ-2, REQ-3, REQ-4
test('in the desktop page, the "Notifications" menu follows "Processes", "Updates" is last, and its sound switch is on; a click turns it off at once', async ({
  page,
}) => {
  await openDesktopPage(page);
  await settingsButton(page).click();
  const menu = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' });
  await expect(menu.getByRole('tab')).toHaveText(['Appearance', 'Shortcuts', 'Processes', 'Notifications', 'Updates']);

  await tab(page, 'Notifications').click();
  const panel = settingsPopup(page).getByRole('tabpanel', { name: 'Notifications' });
  await expect(panel.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'true');

  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(settingsPopup(page)).toBeVisible();
});

// Scenario "No sound with the switch off" (page side); plan-input_sound/REQ-11, REQ-13; assumption "Switch turned on late"
test('with the switch off a sound request plays nothing; turning it on plays nothing by itself, the next request plays', async ({ page }) => {
  await openDesktopPage(page);
  await openSoundMenu(page);

  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await requestSound(page);
  await page.waitForTimeout(500);
  expect(await plays(page)).toEqual([]);

  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(500);
  expect(await plays(page)).toEqual([]);

  await requestSound(page);
  await expect.poll(async () => (await plays(page)).length).toBe(1);
  expect((await plays(page))[0]).toMatch(/needs-input-chime.*\.wav$/);
});

// spec SettingsDialog and SoundSection, Keyboard
test('the arrow keys reach "Notifications", Tab reaches the sound switch with a focus ring, and Space toggles it', async ({ page }) => {
  await openDesktopPage(page);
  await settingsButton(page).click();
  await tab(page, 'Processes').click();
  await page.keyboard.press('ArrowDown');
  await expect(tab(page, 'Notifications')).toBeFocused();
  await expect(tab(page, 'Notifications')).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Tab');
  await expect(soundSwitch(page)).toBeFocused();
  expect(await showsFocusRing(page), 'focus ring on the switch').toBe(true);

  await page.keyboard.press('Space');
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Space');
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'true');

  // The remote switch is disabled with no topic URL, so no Tab stop (RemoteNotificationSection spec).
  await page.keyboard.press('Tab');
  await expect(settingsPopup(page).getByRole('textbox', { name: 'Topic URL', exact: true })).toBeFocused();
});

// plan-input_sound/REQ-12 (page side): the choice is kept in the page storage
test('the switch stays off after a reload of the desktop page, and a request still plays nothing', async ({ page }) => {
  await openDesktopPage(page);
  await openSoundMenu(page);
  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');

  await page.reload();
  await expect(settingsButton(page)).toBeVisible();
  await expect.poll(() => listeners(page)).toBe(1);
  await requestSound(page);
  await openSoundMenu(page);
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');
  expect(await plays(page)).toEqual([]);
});

// plan-input_sound/REQ-10: the switch belongs to the desktop app; plan-remote_notifications/REQ-3: "Updates" is last
test('in a browser the settings have no "Notifications" menu, and "Updates" is last', async ({ page }) => {
  await page.goto('/');
  await settingsButton(page).click();
  const menu = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' });
  await expect(menu.getByRole('tab')).toHaveText(['Appearance', 'Shortcuts', 'Processes', 'Updates']);
  await expect(settingsPopup(page).getByRole('switch', { name: SWITCH })).toHaveCount(0);
});
