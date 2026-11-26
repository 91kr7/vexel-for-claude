// e2e of plan-remote_notifications, batches notifications-section and test-notification, in the browser. A fake bridge makes the page a
// desktop window, records each save of the remote settings and holds each test request until the test answers it. The restart of the
// desktop app and the real send are in desktop-remote-settings.spec.ts.
import { type Page, expect, test } from '@playwright/test';
import { settingsButton, settingsPopup } from './settings';

const SOUND = 'Play a sound when a session needs input';
const REMOTE = 'Send a remote notification after 60 seconds of waiting';
const TOPIC = 'https://ntfy.sh/my-topic';

type Settings = { enabled: boolean; topicUrl: string; token: string };
type TestResult = { status: 'sent' } | { status: 'failed'; reason: string } | null;
type Probe = { saves: Settings[]; tests: number; answer: (result: TestResult) => void };

/** The DesktopBridge of the window, with `read` as the stored remote settings. */
async function openDesktopPage(page: Page, read: Settings = { enabled: false, topicUrl: '', token: '' }): Promise<void> {
  await page.addInitScript((stored: Settings) => {
    let pending: ((result: TestResult) => void)[] = [];
    const probe: Probe = {
      saves: [],
      tests: 0,
      answer: (result) => {
        for (const resolve of pending.splice(0)) resolve(result);
      },
    };
    let current = stored;
    Object.assign(window, {
      e2eRemote: probe,
      desktopBridge: {
        reportOpenSession: () => {},
        onOpenSession: () => () => {},
        getPathForFile: () => '',
        readRemoteSettings: () => Promise.resolve({ ...current }),
        saveRemoteSettings: (settings: Settings) => {
          current = { ...settings };
          probe.saves.push(current);
          return Promise.resolve();
        },
        sendTestNotification: () => {
          probe.tests += 1;
          return new Promise<TestResult>((resolve) => pending.push(resolve));
        },
      },
    });
  }, read);
  await page.goto('/');
  await expect(settingsButton(page)).toBeVisible();
}

const saves = (page: Page) => page.evaluate(() => [...(window as unknown as { e2eRemote: Probe }).e2eRemote.saves]);
const testRequests = (page: Page) => page.evaluate(() => (window as unknown as { e2eRemote: Probe }).e2eRemote.tests);
const answerTest = (page: Page, result: TestResult) => page.evaluate((value) => (window as unknown as { e2eRemote: Probe }).e2eRemote.answer(value), result);
const tab = (page: Page, name: string) => settingsPopup(page).getByRole('tab', { name, exact: true });
const panel = (page: Page) => settingsPopup(page).getByRole('tabpanel', { name: 'Notifications' });
const soundSwitch = (page: Page) => panel(page).getByRole('switch', { name: SOUND, exact: true });
const remoteSwitch = (page: Page) => panel(page).getByRole('switch', { name: REMOTE, exact: true });
const topicField = (page: Page) => panel(page).getByRole('textbox', { name: 'Topic URL', exact: true });
const tokenField = (page: Page) => panel(page).getByLabel('Access token (optional)', { exact: true });
const testButton = (page: Page) => panel(page).getByRole('button', { name: 'Send test notification', exact: true });

async function openNotifications(page: Page): Promise<void> {
  await settingsButton(page).click();
  await expect(settingsPopup(page)).toBeVisible();
  await tab(page, 'Notifications').click();
  await expect(topicField(page)).toBeEnabled();
}

/** Whether the focused element matches `:focus-visible` and draws an outline or a box-shadow. */
const showsFocusRing = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return element.matches(':focus-visible') && ((style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none');
  });

// Scenario "The user sets up the remote notification"
test('REQ-1..REQ-8, REQ-11, REQ-13: the user sets the topic URL and the token and turns the remote switch on, at once and with no reload', async ({ page }) => {
  await openDesktopPage(page);
  await page.evaluate(() => Object.assign(window, { e2eSamePage: true }));
  await settingsButton(page).click();
  const menu = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' });
  await expect(menu.getByRole('tab'), 'REQ-1, REQ-2, REQ-3').toHaveText(['Appearance', 'Shortcuts', 'Processes', 'Notifications', 'Updates']);

  await tab(page, 'Notifications').click();
  await expect(panel(page).getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await expect(soundSwitch(page), 'REQ-4').toHaveAttribute('aria-checked', 'true');
  await expect(remoteSwitch(page), 'REQ-5: off by default').toHaveAttribute('aria-checked', 'false');
  await expect(remoteSwitch(page), 'REQ-10: locked with no URL').toBeDisabled();
  await expect(topicField(page)).toHaveValue('');
  await expect(topicField(page)).toHaveAttribute('placeholder', 'https://ntfy.sh/your-topic');
  await expect(tokenField(page), 'REQ-8').toHaveAttribute('type', 'password');
  const soundBox = (await soundSwitch(page).boundingBox())!;
  expect((await remoteSwitch(page).boundingBox())!.y, 'the remote settings sit under the sound switch').toBeGreaterThan(soundBox.y);

  await topicField(page).fill(TOPIC);
  await tokenField(page).fill('tk_secret');
  await expect(remoteSwitch(page)).toBeEnabled();
  await remoteSwitch(page).click();

  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(topicField(page)).toHaveValue(TOPIC);
  await expect(tokenField(page)).toHaveValue('tk_secret');
  await expect(tokenField(page)).toHaveAttribute('type', 'password');
  await expect(soundSwitch(page), 'REQ-13: the sound switch is still on').toHaveAttribute('aria-checked', 'true');
  await expect(settingsPopup(page)).toBeVisible();
  await expect.poll(async () => (await saves(page)).at(-1), 'REQ-11: each change saves the three values').toEqual({ enabled: true, topicUrl: TOPIC, token: 'tk_secret' });
  expect(await page.evaluate(() => (window as unknown as { e2eSamePage?: boolean }).e2eSamePage), 'REQ-11: no reload').toBe(true);

  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(remoteSwitch(page), 'REQ-13: the remote switch stays on').toHaveAttribute('aria-checked', 'true');
});

// Scenario "A wrong topic URL is rejected"
test('REQ-9, REQ-10: a topic URL with another scheme shows the reason under the field, and the remote switch turns off and stays locked', async ({ page }) => {
  await openDesktopPage(page, { enabled: true, topicUrl: TOPIC, token: 'tk' });
  await openNotifications(page);
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'true');

  await topicField(page).fill('ftp://ntfy.sh/my-topic');
  const reason = panel(page).getByRole('alert');
  await expect(reason).toHaveText('Enter an http or https address.');
  expect((await reason.boundingBox())!.y, 'the reason shows under the field').toBeGreaterThan((await topicField(page).boundingBox())!.y);
  await expect(topicField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(topicField(page)).toHaveAccessibleDescription('Enter an http or https address.');
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(remoteSwitch(page)).toBeDisabled();
  await remoteSwitch(page).click({ force: true });
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await saves(page)).at(-1)).toEqual({ enabled: false, topicUrl: 'ftp://ntfy.sh/my-topic', token: 'tk' });
});

// plan-remote_notifications/REQ-9: every reason, and none for an empty field
test('REQ-9: the other reasons show under the field, and an empty field shows none', async ({ page }) => {
  await openDesktopPage(page);
  await openNotifications(page);
  const reason = panel(page).getByRole('alert');

  await topicField(page).fill('https://ntfy.sh/');
  await expect(reason).toHaveText('Add the topic name at the end of the address.');
  await topicField(page).fill('https://ntfy.sh/my.topic');
  await expect(reason).toHaveText('The topic name may use only letters, digits, - and _.');
  await expect(remoteSwitch(page)).toBeDisabled();

  await topicField(page).fill('');
  await expect(reason).toHaveCount(0);
  await expect(topicField(page)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(remoteSwitch(page), 'REQ-10').toBeDisabled();

  await topicField(page).fill('https://ntfy.example.com/ntfy/my_topic');
  await expect(reason).toHaveCount(0);
  await expect(remoteSwitch(page), 'REQ-6: another ntfy server').toBeEnabled();
});

// spec RemoteNotificationSection, Keyboard; decision "Controls": keyboard and focus ring
test('Tab goes through the sound switch, the remote switch, "Topic URL", "Access token (optional)" and "Send test notification" with a focus ring; Space flips the remote switch', async ({
  page,
}) => {
  await openDesktopPage(page, { enabled: false, topicUrl: TOPIC, token: '' });
  await openNotifications(page);
  await tab(page, 'Notifications').focus();

  for (const [control, name] of [
    [soundSwitch(page), 'sound switch'],
    [remoteSwitch(page), 'remote switch'],
    [topicField(page), 'Topic URL'],
    [tokenField(page), 'Access token (optional)'],
    [testButton(page), 'Send test notification'],
  ] as const) {
    await page.keyboard.press('Tab');
    await expect(control, name).toBeFocused();
    expect(await showsFocusRing(page), `focus ring on ${name}`).toBe(true);
  }
  await page.keyboard.press('Tab');
  await expect(settingsPopup(page).getByRole('button', { name: 'Close', exact: true })).toBeFocused();

  await remoteSwitch(page).focus();
  await page.keyboard.press('Space');
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await saves(page)).length).toBe(2);
});

// Scenario "The test notification reaches the phone", page side: the switch stays off
test('REQ-14, REQ-15, REQ-16: "Send test notification" is busy while the test runs, then the section shows "Test notification sent."', async ({ page }) => {
  await openDesktopPage(page);
  await openNotifications(page);
  await expect(testButton(page), 'REQ-14').toBeVisible();
  await expect(testButton(page), 'disabled with an empty URL').toBeDisabled();
  await topicField(page).fill(TOPIC);
  await expect(remoteSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(testButton(page), 'enabled with the switch off').toBeEnabled();
  expect((await testButton(page).boundingBox())!.y, 'the button sits under the token field').toBeGreaterThan((await tokenField(page).boundingBox())!.y);

  await testButton(page).click();
  await expect.poll(() => testRequests(page), 'REQ-15: one test request').toBe(1);
  await expect(testButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(testButton(page)).toBeDisabled();
  await testButton(page).click({ force: true });
  expect(await testRequests(page), 'a second press does nothing').toBe(1);

  await answerTest(page, { status: 'sent' });
  const sent = panel(page).getByRole('status');
  await expect(sent, 'REQ-16').toHaveText('Test notification sent.');
  expect((await sent.boundingBox())!.y, 'the result shows under the button').toBeGreaterThan((await testButton(page).boundingBox())!.y);
  await expect(testButton(page)).toBeEnabled();
  await expect(testButton(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(remoteSwitch(page), 'the test does not turn the switch on').toHaveAttribute('aria-checked', 'false');

  await settingsPopup(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(settingsPopup(page)).toHaveCount(0);
  await openNotifications(page);
  await expect(panel(page).getByRole('status'), 'the result goes with the popup').toHaveCount(0);
});

// Scenario "A refused token is reported", page side
test('REQ-17, REQ-18: a failed test shows its reason in the error colour, without the token; a new press clears it', async ({ page }) => {
  const token = 'tk_wrong_secret';
  await openDesktopPage(page, { enabled: true, topicUrl: TOPIC, token });
  await openNotifications(page);

  await testButton(page).click();
  await expect.poll(() => testRequests(page)).toBe(1);
  await answerTest(page, { status: 'failed', reason: 'The server refused the access token.' });
  const reason = panel(page).getByRole('alert');
  await expect(reason, 'REQ-17').toHaveText('The server refused the access token.');
  await expect(reason, 'REQ-18').not.toContainText(token);
  const colours = await reason.evaluate((element) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-error)';
    element.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    return { text: getComputedStyle(element).color, expected };
  });
  expect(colours.text, 'shows in the error colour').toBe(colours.expected);

  await testButton(page).click();
  await expect(reason, 'a new press clears the old result').toHaveCount(0);
  await answerTest(page, null);
  await expect(testButton(page)).toBeEnabled();
  await expect(panel(page).getByRole('status')).toHaveCount(0);
  await expect(reason).toHaveCount(0);
});

// plan-remote_notifications/REQ-3; constraint "Only the desktop app shows the Notifications section"
test('in a browser the settings have no "Notifications" menu and "Updates" is last', async ({ page }) => {
  await page.goto('/');
  await settingsButton(page).click();
  const menu = settingsPopup(page).getByRole('tablist', { name: 'Settings sections' });
  await expect(menu.getByRole('tab')).toHaveText(['Appearance', 'Shortcuts', 'Processes', 'Updates']);
  await expect(settingsPopup(page).getByRole('switch', { name: REMOTE })).toHaveCount(0);
});
