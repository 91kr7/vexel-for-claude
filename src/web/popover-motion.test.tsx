// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch popovers: the "Motion" entries of PlanUsagePopover, NeedsInputSnackbar,
// ShortMessageToast and NewerVersionNotice, mounted through ExitPresence as AppLayout does.
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitPresence } from './motion/ExitPresence';
import { NeedsInputSnackbar } from './NeedsInputSnackbar';
import { NewerVersionNotice } from './newer-version/NewerVersionNotice';
import { PlanUsagePopover } from './plan-usage/PlanUsagePopover';
import type { SessionSummary } from './sessions/live-session-store';
import { ShortMessageToast } from './ShortMessageToast';

const EXIT_MS = 100;
const VERSION = { installedVersion: '0.1.0', newerVersion: '0.2.0', releaseUrl: 'https://example.com/releases/v0.2.0' };
const session = (id: string, folder: string): SessionSummary => ({ id, folder, label: id, state: 'needs_input', lastActivity: '2026-11-17T10:00:00.000Z' });

let root: Root | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.style.setProperty('--motion-duration-exit', `${EXIT_MS}ms`);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  vi.useRealTimers();
});

const render = (node: ReactNode) => flushSync(() => root?.render(<ExitPresence>{node}</ExitPresence>));
const finishExit = () => flushSync(() => vi.advanceTimersByTime(EXIT_MS + 10));
const press = (target: Element, key: string) => flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
const click = (target: Element) => flushSync(() => (target as HTMLElement).click());
const one = (selector: string) => document.querySelector<HTMLElement>(selector);

describe('PlanUsagePopover motion', () => {
  const popover = () => one('[role="dialog"]');
  const closeButton = () => one('[role="dialog"] button[aria-label="Close"]') as HTMLButtonElement;

  // plan-ui_transitions/REQ-27, REQ-26: the close button and Esc work from the first frame of the opening
  it('closes from the close button at once after it opens', () => {
    const onClose = vi.fn();
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={onClose} />);
    click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Esc at once after it opens', () => {
    const onClose = vi.fn();
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={onClose} />);
    closeButton().focus();
    press(closeButton(), 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // spec: opening still takes no focus
  it('takes no focus when it opens', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(outside);
  });

  // plan-ui_transitions/REQ-4: the closed popover stays while it leaves, hidden from assistive technologies
  it('stays while leaving, hidden from assistive technologies, and goes after the exit', () => {
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={vi.fn()} />);
    expect(popover()?.getAttribute('aria-hidden')).not.toBe('true');
    render(false);
    expect(popover()?.getAttribute('aria-hidden')).toBe('true');
    finishExit();
    expect(popover()).toBeNull();
  });

  // spec: the leaving popover ignores Esc and its close button does nothing
  it('ignores Esc and the close button while leaving', () => {
    const onClose = vi.fn();
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={onClose} />);
    render(false);
    const close = closeButton();
    close.focus();
    press(close, 'Escape');
    click(close);
    expect(onClose).not.toHaveBeenCalled();
  });

  // plan-ui_transitions/REQ-28: opening again during the exit shows a live popover at once
  it('shows a live popover at once when opened again during the exit', () => {
    const onClose = vi.fn();
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={onClose} />);
    render(false);
    render(<PlanUsagePopover state={{ kind: 'loading' }} onClose={onClose} />);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(popover()?.getAttribute('aria-hidden')).not.toBe('true');
    finishExit();
    expect(popover()).not.toBeNull();
    click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NeedsInputSnackbar motion', () => {
  const snackbar = () => one('[role="status"]');
  const openButton = () => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Open') as HTMLButtonElement;

  // plan-ui_transitions/REQ-26: "Open" works from the first frame of the opening
  it('"Open" works at once after it appears', () => {
    const onOpen = vi.fn();
    render(<NeedsInputSnackbar session={session('a', '/home/dev/alpha')} onOpen={onOpen} />);
    click(openButton());
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  // plan-ui_transitions/REQ-4: the leaving snackbar keeps its text, hidden from assistive technologies, and "Open" does nothing
  it('while leaving keeps its text, is hidden from assistive technologies and "Open" does nothing', () => {
    const onOpen = vi.fn();
    render(<NeedsInputSnackbar session={session('a', '/home/dev/alpha')} onOpen={onOpen} />);
    render(false);
    expect(snackbar()?.getAttribute('aria-hidden')).toBe('true');
    expect(snackbar()?.textContent).toContain('alpha needs your input');
    click(openButton());
    expect(onOpen).not.toHaveBeenCalled();
    finishExit();
    expect(snackbar()).toBeNull();
  });

  // spec: the shown session changes while it shows -> the text changes, with no new enter effect
  it('changes only the text when the shown session changes', () => {
    render(<NeedsInputSnackbar session={session('a', '/home/dev/alpha')} onOpen={vi.fn()} />);
    const box = snackbar();
    render(<NeedsInputSnackbar session={session('b', '/home/dev/beta')} onOpen={vi.fn()} />);
    expect(snackbar()).toBe(box);
    expect(box?.textContent).toContain('beta needs your input');
  });
});

describe('ShortMessageToast motion', () => {
  const toast = () => one('[role="status"]');

  // plan-ui_transitions/REQ-4: the leaving toast shows the text it had, hidden from assistive technologies
  it('while leaving shows the text it had, hidden from assistive technologies', () => {
    render(<ShortMessageToast text="No session needs input" />);
    expect(toast()?.getAttribute('aria-hidden')).not.toBe('true');
    render(false);
    expect(toast()?.getAttribute('aria-hidden')).toBe('true');
    expect(toast()?.textContent).toBe('No session needs input');
    finishExit();
    expect(toast()).toBeNull();
  });

  // plan-ui_transitions/REQ-28: a new text while it shows replaces the text, with no new enter effect
  it('replaces the text in the same box when a new text arrives', () => {
    render(<ShortMessageToast text="First" />);
    const box = toast();
    render(<ShortMessageToast text="Second" />);
    expect(toast()).toBe(box);
    expect(box?.textContent).toBe('Second');
  });
});

describe('NewerVersionNotice motion', () => {
  const notice = () => one('[role="status"][aria-label="Update Available"]');
  const closeButton = () => one('button[aria-label="Close Update Notice"]') as HTMLButtonElement;

  // plan-ui_transitions/REQ-26: "Close Update Notice" works from the first frame of the opening
  it('"Close Update Notice" works at once after it appears', () => {
    const onClose = vi.fn();
    render(<NewerVersionNotice version={VERSION} onClose={onClose} />);
    click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // plan-ui_transitions/REQ-4: the leaving notice is hidden from assistive technologies and its close button does nothing
  it('while leaving is hidden from assistive technologies and "Close Update Notice" does nothing', () => {
    const onClose = vi.fn();
    render(<NewerVersionNotice version={VERSION} onClose={onClose} />);
    render(false);
    expect(notice()?.getAttribute('aria-hidden')).toBe('true');
    click(closeButton());
    expect(onClose).not.toHaveBeenCalled();
    finishExit();
    expect(notice()).toBeNull();
  });

  // spec: it takes no focus when it appears
  it('takes no focus when it appears', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    render(<NewerVersionNotice version={VERSION} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(outside);
  });
});
