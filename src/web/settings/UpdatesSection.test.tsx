// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewerVersion } from '../newer-version/newer-version-loader';
import type { UpdateCheckResult } from '../newer-version/update-check-client';
import { mount, run, unmountAll } from './settings-test-support';
import { UpdatesSection } from './UpdatesSection';

// Unit tests of the "Updates" section, plan-settings_dialog/REQ-44, REQ-46, REQ-47, REQ-48, REQ-50:
// a fake check stands in for the route, a fake fetch for the installed version.
const VERSION: NewerVersion = { installedVersion: '0.6.1', newerVersion: '0.7.0', releaseUrl: 'https://github.com/owner/name/releases/tag/v0.7.0' };

let installedAnswer: () => Promise<Response>;

beforeEach(() => {
  installedAnswer = () => Promise.resolve(new Response(JSON.stringify({ version: '0.6.1' }), { status: 200 }));
  vi.stubGlobal(
    'fetch',
    vi.fn(() => installedAnswer()),
  );
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

/** A check that stays pending until `finish` is called; `signals` holds the signal of each run. */
function heldCheck() {
  const held = {
    finish: (_result: UpdateCheckResult) => {},
    signals: [] as Array<AbortSignal | undefined>,
    check: vi.fn((signal?: AbortSignal) => {
      held.signals.push(signal);
      return new Promise<UpdateCheckResult>((resolve) => (held.finish = resolve));
    }),
  };
  return held;
}

function render(check: (signal?: AbortSignal) => Promise<UpdateCheckResult>, onNewerVersion = vi.fn()) {
  const host = mount(<UpdatesSection onNewerVersion={onNewerVersion} check={check} />);
  return { host, onNewerVersion };
}

const button = (host: HTMLElement) => host.querySelector('button') as HTMLButtonElement;
const statusText = (host: HTMLElement) => host.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const alertText = (host: HTMLElement) => host.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
const until = (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true));

async function checked(host: HTMLElement, held: ReturnType<typeof heldCheck>, result: UpdateCheckResult) {
  run(() => button(host).click());
  run(() => held.finish(result));
  await until(() => button(host).textContent === 'Check for Updates');
}

describe('UpdatesSection', () => {
  // plan-settings_dialog/REQ-44
  it('shows the label "Updates", the installed version and "Check for Updates"', async () => {
    const { host } = render(heldCheck().check);
    expect(host.querySelector('#' + CSS.escape(host.querySelector('section')?.getAttribute('aria-labelledby') ?? ''))?.textContent).toBe('Updates');
    await until(() => host.textContent?.includes('Installed version: v0.6.1') ?? false);
    expect(button(host).textContent).toBe('Check for Updates');
    expect(button(host).disabled).toBe(false);
    expect(statusText(host)).toBeNull();
    expect(alertText(host)).toBeNull();
  });

  it('hides the installed version while it is unknown', async () => {
    installedAnswer = () => Promise.resolve(new Response('nope', { status: 500 }));
    const { host } = render(heldCheck().check);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(host.textContent).not.toContain('Installed version');
    expect(button(host).textContent).toBe('Check for Updates');
  });

  // plan-settings_dialog/REQ-46
  it('reads "Checking…" and is disabled while the check runs, with no result shown', () => {
    const held = heldCheck();
    const { host } = render(held.check);
    run(() => button(host).click());
    expect(held.check).toHaveBeenCalledTimes(1);
    expect(button(host).textContent).toBe('Checking…');
    expect(button(host).disabled).toBe(true);
    expect(statusText(host)).toBeNull();
    expect(alertText(host)).toBeNull();
  });

  // plan-settings_dialog/REQ-47
  it('shows "You are up to date (v<installed>)" with the version of the answer, and enables the button again', async () => {
    const held = heldCheck();
    const { host, onNewerVersion } = render(held.check);
    await checked(host, held, { status: 'current', installedVersion: '0.6.2' });
    expect(statusText(host)).toBe('You are up to date (v0.6.2)');
    expect(button(host).disabled).toBe(false);
    expect(onNewerVersion).not.toHaveBeenCalled();
  });

  // plan-settings_dialog/REQ-48
  it('shows both versions and "View Release" to the release page in a new tab', async () => {
    const held = heldCheck();
    const { host } = render(held.check);
    await checked(host, held, { status: 'newer', version: VERSION });
    const status = host.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('Version 0.7.0 is available. You have 0.6.1.');
    const link = [...status.querySelectorAll('a')].find((anchor) => anchor.textContent === 'View Release') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(VERSION.releaseUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  // plan-settings_dialog/REQ-49 (through the popup): the newer version goes out once
  it('calls onNewerVersion once with the version of a newer result', async () => {
    const held = heldCheck();
    const { host, onNewerVersion } = render(held.check);
    await checked(host, held, { status: 'newer', version: VERSION });
    expect(onNewerVersion).toHaveBeenCalledTimes(1);
    expect(onNewerVersion).toHaveBeenCalledWith(VERSION);
  });

  // plan-settings_dialog/REQ-50
  it('shows the error "Could not check for updates. Try again later." on a failure', async () => {
    const held = heldCheck();
    const { host, onNewerVersion } = render(held.check);
    await checked(host, held, { status: 'failed' });
    expect(alertText(host)).toBe('Could not check for updates. Try again later.');
    expect(statusText(host)).toBeNull();
    expect(button(host).disabled).toBe(false);
    expect(onNewerVersion).not.toHaveBeenCalled();
  });

  // spec UpdatesSection: a new check replaces the shown result
  it('hides the previous result during a new check and replaces it with the new one', async () => {
    const held = heldCheck();
    const { host } = render(held.check);
    await checked(host, held, { status: 'failed' });
    run(() => button(host).click());
    expect(alertText(host)).toBeNull();
    run(() => held.finish({ status: 'current', installedVersion: '0.6.1' }));
    await until(() => statusText(host) !== null);
    expect(statusText(host)).toBe('You are up to date (v0.6.1)');
    expect(alertText(host)).toBeNull();
    expect(held.check).toHaveBeenCalledTimes(2);
  });

  // spec UpdatesSection: an unmount aborts the running check, and its late answer calls nothing
  it('aborts the running check on unmount and ignores its late answer', async () => {
    const held = heldCheck();
    const { host, onNewerVersion } = render(held.check);
    run(() => button(host).click());
    unmountAll();
    expect(held.signals[0]?.aborted).toBe(true);
    held.finish({ status: 'newer', version: VERSION });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onNewerVersion).not.toHaveBeenCalled();
  });
});
