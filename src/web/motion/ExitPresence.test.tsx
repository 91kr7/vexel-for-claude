// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch modal-dialogs: ExitPresence spec.
import { type ReactNode, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitPresence, useLeaving } from './ExitPresence';

const EXIT_MS = 100;

let root: Root | undefined;
let container: HTMLElement;

function Probe({ label }: { label: string }) {
  const leaving = useLeaving();
  const [count, setCount] = useState(0);
  return (
    <button type="button" data-label={label} data-leaving={String(leaving)} onClick={() => setCount((value) => value + 1)}>
      {count}
    </button>
  );
}

function Owner({ open }: { open: boolean }) {
  return <ExitPresence>{open && <Probe label="item" />}</ExitPresence>;
}

const probe = (label = 'item') => document.querySelector<HTMLButtonElement>(`[data-label="${label}"]`);
const render = (node: ReactNode) => flushSync(() => root?.render(node));
const setExitToken = (value: string | null) => {
  if (value === null) document.documentElement.style.removeProperty('--motion-duration-exit');
  else document.documentElement.style.setProperty('--motion-duration-exit', value);
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  setExitToken(`${EXIT_MS}ms`);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
});

describe('ExitPresence', () => {
  // ExitPresence "Contract": an open element is shown and not leaving
  it('shows the element with useLeaving() false while the condition is true', () => {
    render(<Owner open />);
    expect(probe()?.dataset.leaving).toBe('false');
  });

  // ExitPresence "Contract": outside any ExitPresence useLeaving() is false
  it('gives useLeaving() false outside any ExitPresence', () => {
    render(<Probe label="free" />);
    expect(probe('free')?.dataset.leaving).toBe('false');
  });

  // ExitPresence "Contract": nothing is mounted for a false condition
  it('mounts nothing while the condition is false from the start', () => {
    render(<Owner open={false} />);
    expect(probe()).toBeNull();
  });

  // plan-ui_transitions/REQ-2: a closed element stays mounted, with its state, while leaving, then goes
  it('keeps the closed element with its state and useLeaving() true, then removes it after the exit token', async () => {
    render(<Owner open />);
    flushSync(() => probe()?.click());
    expect(probe()?.textContent).toBe('1');

    render(<Owner open={false} />);
    expect(probe()?.dataset.leaving).toBe('true');
    expect(probe()?.textContent).toBe('1');

    await pause(EXIT_MS / 3);
    expect(probe(), 'removed before the exit token ends').not.toBeNull();
    await vi.waitFor(() => expect(probe()).toBeNull(), { timeout: EXIT_MS * 5, interval: 10 });
  });

  // plan-ui_transitions/REQ-25: exit token 0 (reduced motion) removes the element at once
  it('removes the element at once when the exit token is 0ms', () => {
    setExitToken('0ms');
    render(<Owner open />);
    render(<Owner open={false} />);
    expect(probe()).toBeNull();
  });

  // ExitPresence "Contract": exit token not set (no style sheet) removes the element at once
  it('removes the element at once when the exit token is not set', () => {
    setExitToken(null);
    render(<Owner open />);
    render(<Owner open={false} />);
    expect(probe()).toBeNull();
  });

  // plan-ui_transitions/REQ-28: a new open during the exit wins, with fresh state, and the old exit does not remove it
  it('opens a fresh element when the condition turns true during the exit', async () => {
    render(<Owner open />);
    flushSync(() => probe()?.click());
    render(<Owner open={false} />);
    expect(probe()?.dataset.leaving).toBe('true');

    render(<Owner open />);
    expect(document.querySelectorAll('[data-label="item"]')).toHaveLength(1);
    expect(probe()?.dataset.leaving).toBe('false');
    expect(probe()?.textContent, 'fresh state').toBe('0');

    await pause(EXIT_MS * 2);
    expect(probe()?.dataset.leaving).toBe('false');
  });

  // plan-ui_transitions/REQ-28: closing again after a reopen leaves the element closed
  it('ends closed after close, reopen and close during the exit', async () => {
    render(<Owner open />);
    render(<Owner open={false} />);
    render(<Owner open />);
    render(<Owner open={false} />);
    expect(probe()?.dataset.leaving).toBe('true');
    await vi.waitFor(() => expect(probe()).toBeNull(), { timeout: EXIT_MS * 5, interval: 10 });
  });

  // ExitPresence "Contract": an element inside a leaving element is leaving too
  it('marks a nested element as leaving when its outer element leaves', () => {
    const Nested = ({ open }: { open: boolean }) => (
      <ExitPresence>
        {open && (
          <div>
            <ExitPresence>
              <Probe label="inner" />
            </ExitPresence>
          </div>
        )}
      </ExitPresence>
    );
    render(<Nested open />);
    expect(probe('inner')?.dataset.leaving).toBe('false');
    render(<Nested open={false} />);
    expect(probe('inner')?.dataset.leaving).toBe('true');
  });

  // ExitPresence "Contract": the owner unmounts, the element goes with it with no exit
  it('removes the element at once when the owner unmounts', () => {
    render(<Owner open />);
    render(null);
    expect(probe()).toBeNull();
  });

  // ExitPresence "Contract": a portal as the element gets the leaving state
  it('passes the leaving state to a portal', () => {
    const Portal = ({ open }: { open: boolean }) => (
      <ExitPresence>{open && createPortal(<Probe label="portal" />, document.body)}</ExitPresence>
    );
    render(<Portal open />);
    expect(probe('portal')?.dataset.leaving).toBe('false');
    render(<Portal open={false} />);
    expect(probe('portal')?.dataset.leaving).toBe('true');
  });
});
