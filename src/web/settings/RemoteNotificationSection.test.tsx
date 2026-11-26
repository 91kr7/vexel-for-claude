// @vitest-environment jsdom
// Tests of plan-remote_notifications, batches notifications-section and test-notification: RemoteNotificationSection spec. A fake bridge
// stands in for the desktop app.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSettings, TestNotificationResult } from '../desktop-bridge';
import { RemoteNotificationSection } from './RemoteNotificationSection';
import { mount, run, unmountAll } from './settings-test-support';

const SWITCH = 'Send a remote notification after 60 seconds of waiting';
const VALID = 'https://ntfy.sh/my-topic';
const NOT_WEB_ADDRESS = 'Enter an http or https address.';
const NO_TOPIC = 'Add the topic name at the end of the address.';
const BAD_TOPIC = 'The topic name may use only letters, digits, - and _.';
const TEST_BUTTON = 'Send test notification';
const SENT = 'Test notification sent.';
const REFUSED = 'The server refused the access token.';

afterEach(() => {
  unmountAll();
  delete (window as { desktopBridge?: unknown }).desktopBridge;
});

/** A desktop bridge whose read answers only when `answer` is called; each save is recorded. Each test request waits for `results`. */
function fakeBridge() {
  let answer: (settings: RemoteSettings) => void = () => {};
  const read = new Promise<RemoteSettings>((resolve) => (answer = resolve));
  const save = vi.fn((_settings: RemoteSettings) => Promise.resolve());
  const results: ((result: TestNotificationResult | null) => void)[] = [];
  const send = vi.fn(() => new Promise<TestNotificationResult | null>((resolve) => results.push(resolve)));
  Object.assign(window, {
    desktopBridge: {
      reportOpenSession: () => {},
      onOpenSession: () => () => {},
      getPathForFile: () => '',
      readRemoteSettings: () => read,
      saveRemoteSettings: save,
      sendTestNotification: send,
    },
  });
  return { answer, save, send, results };
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
    testButton: [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === TEST_BUTTON) as HTMLButtonElement,
  };
}

/** Mounts the section and answers the read with `settings`. */
async function show(settings: RemoteSettings = { enabled: false, topicUrl: '', token: '' }) {
  const bridge = fakeBridge();
  const host = mount(<RemoteNotificationSection />);
  bridge.answer(settings);
  await flush();
  return { host, save: bridge.save, send: bridge.send, results: bridge.results, ...controls(host) };
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

  // spec Keyboard: switch, "Topic URL", "Access token (optional)", "Send test notification" in this order; a disabled switch or button is no Tab stop
  it('has the switch, "Topic URL", "Access token (optional)" and "Send test notification" as Tab stops in this order', async () => {
    const { host, toggle, url, token, testButton } = await show({ enabled: false, topicUrl: VALID, token: '' });
    const stops = () => [...host.querySelectorAll<HTMLElement>('button, input, [tabindex]')].filter((element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled);
    expect(stops()).toEqual([toggle, url, token, testButton]);
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

  describe('test notification', () => {
    const status = (host: HTMLElement) => [...host.querySelectorAll('[role="status"]')].map((element) => element.textContent?.trim());
    const follows = (later: Element, earlier: Element) => Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

    // plan-remote_notifications/REQ-14
    it(`shows the button "${TEST_BUTTON}" under "Access token (optional)"`, async () => {
      const { token, testButton } = await show({ enabled: false, topicUrl: VALID, token: '' });
      expect(testButton).toBeDefined();
      expect(follows(testButton, token)).toBe(true);
    });

    it('keeps the button disabled until the read answers', async () => {
      const bridge = fakeBridge();
      const host = mount(<RemoteNotificationSection />);
      expect(controls(host).testButton.disabled).toBe(true);
      bridge.answer({ enabled: false, topicUrl: VALID, token: '' });
      await flush();
      expect(controls(host).testButton.disabled).toBe(false);
    });

    // Assumption "Test button and remote switch"
    it.each([
      ['empty', ''],
      ['invalid', 'https://ntfy.sh/'],
    ])('disables the button while the URL is %s: a click sends nothing', async (_name, value) => {
      const { testButton, send } = await show({ enabled: false, topicUrl: value, token: '' });
      expect(testButton.disabled).toBe(true);
      run(() => testButton.click());
      expect(send).not.toHaveBeenCalled();
    });

    it.each([
      ['off', false],
      ['on', true],
    ])('enables the button with a valid URL and the switch %s', async (_name, enabled) => {
      const { testButton } = await show({ enabled, topicUrl: VALID, token: '' });
      expect(testButton.disabled).toBe(false);
    });

    it('disables the button when the URL turns invalid, and enables it when it turns valid', async () => {
      const { url, testButton } = await show();
      expect(testButton.disabled).toBe(true);
      type(url, VALID);
      expect(testButton.disabled).toBe(false);
      type(url, 'ftp://ntfy.sh/my-topic');
      expect(testButton.disabled).toBe(true);
    });

    // plan-remote_notifications/REQ-15: a press asks the desktop app for the test; it runs busy, and a second press does nothing
    it('a press asks for one test; until the answer the button is disabled, busy, with a spinner and the same name', async () => {
      const { testButton, send, results } = await show({ enabled: false, topicUrl: VALID, token: 'tk' });
      run(() => testButton.click());
      expect(send).toHaveBeenCalledTimes(1);
      expect(testButton.disabled).toBe(true);
      expect(testButton.getAttribute('aria-busy')).toBe('true');
      expect(testButton.querySelector('.spinner')).not.toBeNull();
      expect(testButton.textContent?.trim()).toBe(TEST_BUTTON);
      run(() => testButton.click());
      expect(send).toHaveBeenCalledTimes(1);

      results[0]?.({ status: 'sent' });
      await flush();
      expect(testButton.disabled).toBe(false);
      expect(testButton.getAttribute('aria-busy')).not.toBe('true');
      expect(testButton.querySelector('.spinner')).toBeNull();
    });

    // plan-remote_notifications/REQ-16
    it(`shows "${SENT}" as a status under the button after a successful send`, async () => {
      const { host, testButton, results } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => testButton.click());
      expect(status(host)).toEqual([]);
      results[0]?.({ status: 'sent' });
      await flush();
      expect(status(host)).toEqual([SENT]);
      expect(follows(host.querySelector('[role="status"]')!, testButton)).toBe(true);
      expect(alerts(host)).toEqual([]);
    });

    // plan-remote_notifications/REQ-17
    it('shows the reason of a failed send as an error under the button', async () => {
      const { host, testButton, results } = await show({ enabled: true, topicUrl: VALID, token: 'tk_wrong' });
      run(() => testButton.click());
      results[0]?.({ status: 'failed', reason: REFUSED });
      await flush();
      expect(alerts(host)).toEqual([REFUSED]);
      expect(follows(host.querySelector('[role="alert"]')!, testButton)).toBe(true);
      expect(status(host)).toEqual([]);
    });

    it('shows no result when the answer is null', async () => {
      const { host, testButton, results } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => testButton.click());
      results[0]?.(null);
      await flush();
      expect(status(host)).toEqual([]);
      expect(alerts(host)).toEqual([]);
      expect(testButton.disabled).toBe(false);
    });

    it('a new press clears the previous result, which then gives way to the new one', async () => {
      const { host, testButton, results } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => testButton.click());
      results[0]?.({ status: 'failed', reason: REFUSED });
      await flush();
      expect(alerts(host)).toEqual([REFUSED]);
      run(() => testButton.click());
      expect(alerts(host)).toEqual([]);
      expect(status(host)).toEqual([]);
      results[1]?.({ status: 'sent' });
      await flush();
      expect(status(host)).toEqual([SENT]);
      expect(alerts(host)).toEqual([]);
    });

    it('keeps the result while the user edits the token, and drops it when the section unmounts', async () => {
      const { host, token, testButton, results } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => testButton.click());
      results[0]?.({ status: 'sent' });
      await flush();
      type(token, 'tk_new');
      expect(status(host)).toEqual([SENT]);

      unmountAll();
      const again = await show({ enabled: false, topicUrl: VALID, token: '' });
      expect(status(again.host)).toEqual([]);
    });

    it('ignores an answer that arrives after the section unmounts', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { testButton, results } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => testButton.click());
      unmountAll();
      results[0]?.({ status: 'sent' });
      await flush();
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    // spec RemoteNotificationSection, rule "the section sends nothing to ntfy by itself"
    it('asks for no test at mount or on a change of the controls', async () => {
      const { toggle, url, token, send } = await show({ enabled: false, topicUrl: VALID, token: '' });
      run(() => toggle.click());
      type(token, 'tk');
      type(url, 'https://ntfy.sh/other');
      await flush();
      expect(send).not.toHaveBeenCalled();
    });
  });
});
