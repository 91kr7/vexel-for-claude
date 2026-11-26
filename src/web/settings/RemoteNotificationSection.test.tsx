// @vitest-environment jsdom
// Tests of plan-remote_notifications, batch notifications-section: RemoteNotificationSection spec. A fake bridge stands in for the desktop app.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSettings } from '../desktop-bridge';
import { RemoteNotificationSection } from './RemoteNotificationSection';
import { mount, run, unmountAll } from './settings-test-support';

const SWITCH = 'Send a remote notification after 60 seconds of waiting';
const VALID = 'https://ntfy.sh/my-topic';
const NOT_WEB_ADDRESS = 'Enter an http or https address.';
const NO_TOPIC = 'Add the topic name at the end of the address.';
const BAD_TOPIC = 'The topic name may use only letters, digits, - and _.';

afterEach(() => {
  unmountAll();
  delete (window as { desktopBridge?: unknown }).desktopBridge;
});

/** A desktop bridge whose read answers only when `answer` is called; each save is recorded. */
function fakeBridge() {
  let answer: (settings: RemoteSettings) => void = () => {};
  const read = new Promise<RemoteSettings>((resolve) => (answer = resolve));
  const save = vi.fn((_settings: RemoteSettings) => Promise.resolve());
  Object.assign(window, {
    desktopBridge: { reportOpenSession: () => {}, onOpenSession: () => () => {}, getPathForFile: () => '', readRemoteSettings: () => read, saveRemoteSettings: save },
  });
  return { answer, save };
}

const flush = async () => {
  for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

function controls(host: HTMLElement) {
  const fieldNamed = (name: string) =>
    [...host.querySelectorAll('label')].find((label) => label.textContent?.includes(name))?.querySelector('input') as HTMLInputElement;
  return {
    toggle: host.querySelector<HTMLButtonElement>('[role="switch"]') as HTMLButtonElement,
    url: fieldNamed('Topic URL'),
    token: fieldNamed('Access token (optional)'),
  };
}

/** Mounts the section and answers the read with `settings`. */
async function show(settings: RemoteSettings = { enabled: false, topicUrl: '', token: '' }) {
  const bridge = fakeBridge();
  const host = mount(<RemoteNotificationSection />);
  bridge.answer(settings);
  await flush();
  return { host, save: bridge.save, ...controls(host) };
}

function type(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  run(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const reasonOf = (input: HTMLInputElement) =>
  (input.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
    .trim();
const alerts = (host: HTMLElement) => [...host.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent?.trim());

describe('RemoteNotificationSection', () => {
  it('keeps every control disabled until the read answers', async () => {
    const bridge = fakeBridge();
    const host = mount(<RemoteNotificationSection />);
    const { toggle, url, token } = controls(host);
    expect([toggle.disabled, url.disabled, token.disabled]).toEqual([true, true, true]);
    bridge.answer({ enabled: false, topicUrl: VALID, token: '' });
    await flush();
    expect([toggle.disabled, url.disabled, token.disabled]).toEqual([false, false, false]);
  });

  // plan-remote_notifications/REQ-5, REQ-6, REQ-7, REQ-8: the controls and their defaults
  it(`shows the switch "${SWITCH}" off, the empty "Topic URL" with its placeholder and the empty password field "Access token (optional)"`, async () => {
    const { host, toggle, url, token, save } = await show();
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(1);
    expect(toggle.textContent?.trim()).toBe(SWITCH);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(url.value).toBe('');
    expect(url.placeholder).toBe('https://ntfy.sh/your-topic');
    expect(token.value).toBe('');
    expect(token.type).toBe('password');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows the values read from the desktop app', async () => {
    const { toggle, url, token } = await show({ enabled: true, topicUrl: VALID, token: 'tk_1' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(url.value).toBe(VALID);
    expect(token.value).toBe('tk_1');
  });

  // plan-remote_notifications/REQ-10: no switch on with an empty URL
  it('disables the switch while the URL is empty: a click changes and saves nothing', async () => {
    const { toggle, save } = await show();
    expect(toggle.disabled).toBe(true);
    run(() => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(save).not.toHaveBeenCalled();
  });

  // plan-remote_notifications/REQ-10: no switch on with an invalid URL
  it('disables the switch while the URL is invalid', async () => {
    const { toggle, save } = await show({ enabled: false, topicUrl: 'https://ntfy.sh/', token: '' });
    expect(toggle.disabled).toBe(true);
    run(() => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(save).not.toHaveBeenCalled();
  });

  // plan-remote_notifications/REQ-11: typing shows at once and saves the three values
  it('typing a URL shows it at once, saves the three values and enables the switch once valid', async () => {
    const { toggle, url, save } = await show({ enabled: false, topicUrl: '', token: 'tk' });
    type(url, VALID);
    expect(url.value).toBe(VALID);
    expect(save).toHaveBeenLastCalledWith({ enabled: false, topicUrl: VALID, token: 'tk' });
    expect(toggle.disabled).toBe(false);
  });

  it('typing a token shows it at once and saves the three values', async () => {
    const { token, save } = await show({ enabled: true, topicUrl: VALID, token: '' });
    type(token, 'secret');
    expect(token.value).toBe('secret');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith({ enabled: true, topicUrl: VALID, token: 'secret' });
  });

  // plan-remote_notifications/REQ-11: the switch applies at once
  it('a click on the enabled switch turns it on, then off, saving the three values each time', async () => {
    const { toggle, save } = await show({ enabled: false, topicUrl: VALID, token: 'tk' });
    run(() => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith({ enabled: true, topicUrl: VALID, token: 'tk' });
    run(() => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ enabled: false, topicUrl: VALID, token: 'tk' });
  });

  // Assumption "Topic URL becomes invalid"; plan-remote_notifications/REQ-10
  it.each([
    ['invalid', 'ftp://ntfy.sh/my-topic'],
    ['empty', ''],
  ])('turns the switch off when the URL turns %s while it is on, and saves enabled false', async (_name, value) => {
    const { toggle, url, save } = await show({ enabled: true, topicUrl: VALID, token: 'tk' });
    type(url, value);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.disabled).toBe(true);
    expect(save).toHaveBeenLastCalledWith({ enabled: false, topicUrl: value, token: 'tk' });
    run(() => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('does not turn the switch back on when the URL turns valid again', async () => {
    const { toggle, url, save } = await show({ enabled: true, topicUrl: VALID, token: '' });
    type(url, 'https://ntfy.sh/');
    type(url, VALID);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(save).toHaveBeenLastCalledWith({ enabled: false, topicUrl: VALID, token: '' });
  });

  // spec Switch lock: settings read with the switch on and a bad URL
  it.each([
    ['an invalid', 'https://ntfy.sh/my.topic'],
    ['an empty', ''],
  ])('shows the switch off and saves enabled false once when the read has it on with %s URL', async (_name, value) => {
    const { toggle, save } = await show({ enabled: true, topicUrl: value, token: 'tk' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ enabled: false, topicUrl: value, token: 'tk' });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  // plan-remote_notifications/REQ-9: the reason shows under the field
  it.each([
    ['ftp://ntfy.sh/my-topic', NOT_WEB_ADDRESS],
    ['https://ntfy.sh', NO_TOPIC],
    ['https://ntfy.sh/my topic', BAD_TOPIC],
  ])('typing %s shows "%s" as an alert, marks the field invalid and describes it with the reason', async (value, reason) => {
    const { host, url } = await show();
    type(url, value);
    expect(alerts(host)).toEqual([reason]);
    expect(url.getAttribute('aria-invalid')).toBe('true');
    expect(reasonOf(url)).toBe(reason);
  });

  it.each([
    ['an empty', ''],
    ['a valid', VALID],
  ])('shows no reason and no invalid mark for %s URL', async (_name, value) => {
    const { host, url } = await show();
    type(url, 'ftp://x/y');
    type(url, value);
    expect(alerts(host)).toEqual([]);
    expect(url.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('shows the reason of an invalid URL read at mount', async () => {
    const { host, url } = await show({ enabled: false, topicUrl: 'ntfy.sh/my-topic', token: '' });
    expect(alerts(host)).toEqual([NOT_WEB_ADDRESS]);
    expect(url.getAttribute('aria-invalid')).toBe('true');
  });

  // spec Keyboard: switch, "Topic URL", "Access token (optional)" in this order; a disabled switch is no Tab stop
  it('has the switch, "Topic URL" and "Access token (optional)" as Tab stops in this order', async () => {
    const { host, toggle, url, token } = await show({ enabled: false, topicUrl: VALID, token: '' });
    const stops = () => [...host.querySelectorAll<HTMLElement>('button, input, [tabindex]')].filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
    expect(stops()).toEqual([toggle, url, token]);
    type(url, '');
    expect(stops()).toEqual([url, token]);
  });

  // plan-remote_notifications/REQ-13: the section does not touch the sound switch
  it('leaves the page storage alone', async () => {
    localStorage.clear();
    const { toggle, url, token } = await show({ enabled: false, topicUrl: VALID, token: '' });
    run(() => toggle.click());
    type(token, 'x');
    type(url, '');
    expect(localStorage.length).toBe(0);
  });
});
