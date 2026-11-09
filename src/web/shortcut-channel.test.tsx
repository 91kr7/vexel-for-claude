// @vitest-environment jsdom
// Tests of plan-keyboard_shortcuts, batch session-actions: ShortcutChannel spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type SessionCommand, sendSessionCommand, useSessionCommand } from './shortcut-channel';

interface Props {
  command: SessionCommand;
  run: () => void;
  enabled?: boolean;
}

function Subscriber({ command, run, enabled }: Props) {
  useSessionCommand(command, run, enabled);
  return null;
}

const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
});

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render and its effects at once.
/** Mounts one subscriber in its own root; gives back a rerender and an unmount. */
function mount(props: Props) {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  flushSync(() => root.render(<Subscriber {...props} />));
  return {
    rerender: (next: Props) => flushSync(() => root.render(<Subscriber {...next} />)),
    unmount: () => {
      root.unmount();
      roots.splice(roots.indexOf(root), 1);
    },
  };
}

describe('sendSessionCommand', () => {
  // ShortcutChannel contract, plan-keyboard_shortcuts/REQ-43: no subscriber, nothing happens
  it.each<SessionCommand>(['stop', 'dismiss', 'resume', 'rename'])('does nothing for %s with no subscriber', (command) => {
    expect(() => sendSessionCommand(command)).not.toThrow();
  });

  // ShortcutChannel contract, plan-keyboard_shortcuts/REQ-14, REQ-16, REQ-17, REQ-18, REQ-19: the subscriber runs once, in the same call
  it.each<SessionCommand>(['stop', 'dismiss', 'resume', 'rename'])('calls the subscriber of %s once, in the same call', (command) => {
    const run = vi.fn();
    mount({ command, run });
    sendSessionCommand(command);
    expect(run).toHaveBeenCalledTimes(1);
  });

  // ShortcutChannel contract: a subscriber of another command is not called
  it('does not call a subscriber of another command', () => {
    const stop = vi.fn();
    const rename = vi.fn();
    mount({ command: 'stop', run: stop });
    mount({ command: 'rename', run: rename });
    sendSessionCommand('dismiss');
    sendSessionCommand('resume');
    expect(stop).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    sendSessionCommand('rename');
    expect(stop).not.toHaveBeenCalled();
    expect(rename).toHaveBeenCalledTimes(1);
  });

  // ShortcutChannel contract: with more than one subscriber, only the latest one gets the command
  it('calls only the latest subscriber of a command', () => {
    const first = vi.fn();
    const latest = vi.fn();
    mount({ command: 'resume', run: first });
    mount({ command: 'resume', run: latest });
    sendSessionCommand('resume');
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  // ShortcutChannel contract: the earlier subscriber stays subscribed while it is mounted
  it('calls the earlier subscriber once the latest one unmounts', () => {
    const first = vi.fn();
    const latest = vi.fn();
    mount({ command: 'resume', run: first });
    const second = mount({ command: 'resume', run: latest });
    second.unmount();
    sendSessionCommand('resume');
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).not.toHaveBeenCalled();
  });
});

describe('useSessionCommand', () => {
  // ShortcutChannel contract: unmount removes the subscription
  it('stops receiving after unmount', () => {
    const run = vi.fn();
    const subscriber = mount({ command: 'stop', run });
    subscriber.unmount();
    sendSessionCommand('stop');
    expect(run).not.toHaveBeenCalled();
  });

  // ShortcutChannel contract: enabled false means no subscription
  it('does not subscribe while enabled is false', () => {
    const run = vi.fn();
    mount({ command: 'dismiss', run, enabled: false });
    sendSessionCommand('dismiss');
    expect(run).not.toHaveBeenCalled();
  });

  // ShortcutChannel contract: enabled defaults to true
  it('subscribes when enabled is not given', () => {
    const run = vi.fn();
    mount({ command: 'dismiss', run });
    sendSessionCommand('dismiss');
    expect(run).toHaveBeenCalledTimes(1);
  });

  // ShortcutChannel contract: enabled turning false removes the subscription, turning true again restores it
  it('follows enabled while mounted', () => {
    const run = vi.fn();
    const subscriber = mount({ command: 'stop', run, enabled: true });
    subscriber.rerender({ command: 'stop', run, enabled: false });
    sendSessionCommand('stop');
    expect(run).not.toHaveBeenCalled();

    subscriber.rerender({ command: 'stop', run, enabled: true });
    sendSessionCommand('stop');
    expect(run).toHaveBeenCalledTimes(1);
  });

  // ShortcutChannel contract: run is the latest function passed
  it('calls the latest run passed', () => {
    const before = vi.fn();
    const after = vi.fn();
    const subscriber = mount({ command: 'rename', run: before });
    subscriber.rerender({ command: 'rename', run: after });
    sendSessionCommand('rename');
    expect(after).toHaveBeenCalledTimes(1);
    expect(before).not.toHaveBeenCalled();
  });

  // ShortcutChannel invariant: the channel holds no command, so a later subscriber does not get a command sent before
  it('does not deliver a command sent before the subscription', () => {
    sendSessionCommand('resume');
    const run = vi.fn();
    mount({ command: 'resume', run });
    expect(run).not.toHaveBeenCalled();
    sendSessionCommand('resume');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
