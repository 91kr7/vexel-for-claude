// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch modal-dialogs: Dialog spec, "Motion" and "Focus" while opening and leaving.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitPresence } from '../motion/ExitPresence';
import { Dialog } from './Dialog';

const EXIT_MS = 100;

let root: Root | undefined;
let opener: HTMLButtonElement;
let other: HTMLButtonElement;
let onCancel: Mock<() => void>;
let onPrimary: Mock<() => void>;

function Owner({ open }: { open: boolean }) {
  return (
    <ExitPresence>
      {open && (
        <Dialog title="Title" primaryLabel="Confirm" onPrimary={onPrimary} onCancel={onCancel}>
          <input aria-label="Field" />
        </Dialog>
      )}
    </ExitPresence>
  );
}

const render = (open: boolean) => flushSync(() => root?.render(<Owner open={open} />));
const backdrop = () => document.querySelector<HTMLElement>('.modal-backdrop');
const frame = () => document.querySelector<HTMLElement>('[role="dialog"]');
const press = (target: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  flushSync(() => target.dispatchEvent(event));
  return event;
};

beforeEach(() => {
  document.documentElement.style.setProperty('--motion-duration-exit', `${EXIT_MS}ms`);
  opener = document.createElement('button');
  other = document.createElement('button');
  const container = document.createElement('div');
  document.body.append(opener, other, container);
  onCancel = vi.fn<() => void>();
  onPrimary = vi.fn<() => void>();
  opener.focus();
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
});

describe('Dialog motion', () => {
  // plan-ui_transitions/REQ-27: the dialog takes the focus and Esc works from the first frame of its opening
  it('takes the focus and handles Esc at once on open', () => {
    render(true);
    expect(frame()?.contains(document.activeElement)).toBe(true);
    press(document.activeElement ?? document.body, 'Escape');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // plan-ui_transitions/REQ-27: Enter works from the first frame of the opening
  it('handles Enter at once on open', () => {
    render(true);
    press(document.querySelector('input') ?? document.body, 'Enter');
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  // Dialog "Shows": an open dialog is modal and not leaving
  it('is modal and not marked as leaving while open', () => {
    render(true);
    expect(backdrop()?.classList.contains('is-leaving')).toBe(false);
    expect(backdrop()?.getAttribute('aria-hidden')).toBeNull();
    expect(frame()?.getAttribute('aria-modal')).toBe('true');
  });

  // plan-ui_transitions/REQ-2, REQ-26: the leaving dialog plays the reverse, has no aria-modal and is hidden from assistive technologies
  it('marks the leaving dialog, drops aria-modal and hides it from assistive technologies', () => {
    render(true);
    render(false);
    expect(backdrop()?.classList.contains('is-leaving')).toBe(true);
    expect(backdrop()?.getAttribute('aria-hidden')).toBe('true');
    expect(frame()?.hasAttribute('aria-modal')).toBe(false);
  });

  // plan-ui_transitions/REQ-26, Dialog "Focus": the focus goes back to the opener as soon as the dialog starts to leave
  it('gives the focus back at once when it starts to leave', () => {
    render(true);
    document.querySelector('input')?.focus();
    render(false);
    expect(backdrop(), 'still leaving').not.toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // Dialog "Motion": the final removal does not move the focus again
  it('does not move the focus again on its final removal', async () => {
    render(true);
    render(false);
    other.focus();
    await vi.waitFor(() => expect(backdrop()).toBeNull(), { timeout: EXIT_MS * 5, interval: 10 });
    expect(document.activeElement).toBe(other);
  });

  // Dialog "Motion": the leaving dialog ignores Esc and Enter
  it('ignores Esc and Enter while leaving', () => {
    render(true);
    render(false);
    const target = frame();
    expect(target).not.toBeNull();
    const escape = press(target as Element, 'Escape');
    const enter = press(target as Element, 'Enter');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onPrimary).not.toHaveBeenCalled();
    expect(escape.defaultPrevented).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
  });

  // Dialog "Motion": the leaving dialog traps no focus
  it('does not trap Tab while leaving', () => {
    render(true);
    render(false);
    const event = press(frame() as Element, 'Tab');
    expect(event.defaultPrevented).toBe(false);
  });

  // plan-ui_transitions/REQ-25: with reduced motion (exit token 0) the dialog goes at once and gives the focus back
  it('goes at once and gives the focus back when the exit token is 0ms', () => {
    document.documentElement.style.setProperty('--motion-duration-exit', '0ms');
    render(true);
    render(false);
    expect(backdrop()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // plan-ui_transitions/REQ-28: reopened during its exit, the dialog is a modal open dialog again
  it('is a modal open dialog again when reopened during its exit', () => {
    render(true);
    render(false);
    render(true);
    expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(1);
    expect(backdrop()?.classList.contains('is-leaving')).toBe(false);
    expect(frame()?.getAttribute('aria-modal')).toBe('true');
    expect(frame()?.contains(document.activeElement)).toBe(true);
  });
});
