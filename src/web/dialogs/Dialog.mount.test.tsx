// @vitest-environment jsdom
// Tests of plan-popup_glass, batch termination-margins: Dialog spec, rules "Mount" and "Stacked dialogs".
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

let root: Root | undefined;
let container: HTMLDivElement;
let outerCancel: Mock<() => void>;
let outerPrimary: Mock<() => void>;
let innerCancel: Mock<() => void>;
let innerPrimary: Mock<() => void>;

const backdrops = () => [...document.querySelectorAll<HTMLElement>('.modal-backdrop')];
const outerFrame = () => document.querySelector<HTMLElement>('[role="dialog"]');
const innerFrame = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const press = (target: Element, key: string, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  flushSync(() => target.dispatchEvent(event));
  return event;
};

/** A dialog rendered inside a styled caller, with a warning dialog rendered inside its content (e.g. Settings → Processes). */
function renderNested(inner: boolean) {
  flushSync(() =>
    root?.render(
      <section className="caller" style={{ padding: 0, fontSize: '30px', transform: 'scale(1)' }}>
        <Dialog title="Settings" className="settings-dialog" onCancel={outerCancel} primaryLabel="Save" onPrimary={outerPrimary}>
          <input aria-label="Outer field" />
          {inner && (
            <Dialog tone="warning" title="Terminate the Process?" primaryLabel="Terminate" onPrimary={innerPrimary} onCancel={innerCancel}>
              <input aria-label="Inner field" />
            </Dialog>
          )}
        </Dialog>
      </section>,
    ),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  outerCancel = vi.fn<() => void>();
  outerPrimary = vi.fn<() => void>();
  innerCancel = vi.fn<() => void>();
  innerPrimary = vi.fn<() => void>();
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
});

describe('Dialog mount', () => {
  // plan-popup_glass/REQ-11, Dialog "Mount": the dialog sits at the end of the page body, outside the caller
  it('mounts the dialog at the end of the page body, not inside the caller', () => {
    renderNested(false);
    const [backdrop] = backdrops();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(document.body.lastElementChild).toBe(backdrop);
    expect(container.querySelector('.modal-backdrop')).toBeNull();
    expect(container.querySelector('.caller')?.contains(outerFrame())).toBe(false);
  });

  // plan-popup_glass/REQ-13, Dialog "Mount": a dialog opened inside another one is not mounted inside its frame
  it('mounts a nested dialog at the page body too, outside the frame of the dialog that opens it', () => {
    renderNested(false);
    renderNested(true);
    expect(backdrops()).toHaveLength(2);
    for (const backdrop of backdrops()) expect(backdrop.parentElement).toBe(document.body);
    expect(outerFrame()?.contains(innerFrame())).toBe(false);
    expect(document.body.lastElementChild?.contains(innerFrame())).toBe(true);
  });

  // Dialog "Stacked dialogs": Esc acts on the focused top dialog only, the dialog below stays open
  it('Esc in the nested dialog cancels it and not the dialog below', () => {
    renderNested(true);
    press(innerFrame()?.querySelector('input') ?? document.body, 'Escape');
    expect(innerCancel).toHaveBeenCalledTimes(1);
    expect(outerCancel).not.toHaveBeenCalled();
  });

  // Dialog "Stacked dialogs": Enter acts on the focused top dialog only
  it('Enter in the nested dialog runs its primary action and not the one of the dialog below', () => {
    renderNested(true);
    press(innerFrame()?.querySelector('input') ?? document.body, 'Enter');
    expect(innerPrimary).toHaveBeenCalledTimes(1);
    expect(outerPrimary).not.toHaveBeenCalled();
  });

  // Dialog "Keyboard": Tab wraps among the elements of the focused nested dialog only
  it('Tab from the last element of the nested dialog wraps to its first element', () => {
    renderNested(true);
    const inner = innerFrame();
    const focusable = [...(inner?.querySelectorAll<HTMLElement>('button, input') ?? [])];
    const last = focusable.at(-1);
    last?.focus();
    const event = press(last ?? document.body, 'Tab');
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);
    expect(inner?.contains(document.activeElement)).toBe(true);
  });

  // Dialog "Keyboard": Shift+Tab from the first element of the nested dialog wraps to its last element
  it('Shift+Tab from the first element of the nested dialog wraps to its last element', () => {
    renderNested(true);
    const inner = innerFrame();
    const focusable = [...(inner?.querySelectorAll<HTMLElement>('button, input') ?? [])];
    focusable[0]?.focus();
    const event = press(focusable[0] ?? document.body, 'Tab', true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable.at(-1));
  });
});
