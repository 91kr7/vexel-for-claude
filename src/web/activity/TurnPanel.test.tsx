// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import type { TurnTree } from './turn-store';
import { TurnPanel } from './TurnPanel';

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
  receive(message: unknown): void {
    const event = new MessageEvent('message', { data: JSON.stringify(message) });
    run(() => {
      this.dispatchEvent(event);
      this.onmessage?.(event);
    });
  }
  serverClose(code = 1006): void {
    this.readyState = 3;
    const event = Object.assign(new Event('close'), { code, wasClean: false });
    run(() => {
      this.dispatchEvent(event);
      this.onclose?.(event);
    });
  }
}

const lastSocket = () => FakeWebSocket.instances.at(-1)!;
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, status: 'running', steps: [], groups: [], earlier: [], subagents: [], ...fields });
const marked = (count: number) => Array.from({ length: count }, (_, i) => ({ kind: 'text' as const, text: `[s${i}]` }));
const region = (host: Element) => host.querySelector('section[aria-label="Turn Panel"]')!;
/** The deepest element whose whole text is `text`. */
const leaf = (host: Element, text: string) =>
  [...host.querySelectorAll('*')].find((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));
const button = (host: Element, name: RegExp) => [...host.querySelectorAll('button')].find((element) => name.test(element.textContent ?? ''));

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-11-26T10:00:00.000Z') });
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('TurnPanel', () => {
  // plan-session_activity/REQ-27: a region "Turn Panel" with the title "Current Turn", reading the turn of its session
  it('is a region "Turn Panel" titled "Current Turn" that opens the turn route of its session', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    expect(region(host)).not.toBeNull();
    expect(leaf(region(host), 'Current Turn')).toBeDefined();
    expect(lastSocket().url).toMatch(/\/api\/sessions\/s1\/turn$/);
  });

  // turn-panel spec: "Loading…" before the first frame, "Turn not available." when the socket closes before it
  it('says "Loading…" before the first frame and "Turn not available." when the socket closes before it', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    expect(region(host).textContent).toContain('Loading…');
    lastSocket().serverClose();
    expect(region(host).textContent).toContain('Turn not available.');
    expect(region(host).textContent).not.toContain('Loading…');
  });

  // plan-session_activity/REQ-41: no turn yet → "No turn yet." and no status chip
  it('says "No turn yet." with no status chip before the first turn', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ number: 0, status: 'none' }) });
    expect(region(host).textContent).toContain('No turn yet.');
    expect(leaf(host, 'Running')).toBeUndefined();
    expect(leaf(host, 'Ended')).toBeUndefined();
  });

  // plan-session_activity/REQ-28, REQ-40: the chip "Running" while the turn runs, "Ended" once it ended, and the tree
  it('shows the chip "Running", then "Ended", with the tree of the turn', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ steps: [{ kind: 'text', text: 'Working on it' }] }) });
    expect(leaf(host, 'Running')).toBeDefined();
    expect(region(host).textContent).toContain('Working on it');
    lastSocket().receive({ type: 'update', status: 'ended' });
    expect(leaf(host, 'Ended')).toBeDefined();
    expect(leaf(host, 'Running')).toBeUndefined();
    expect(region(host).textContent).toContain('Working on it');
  });

  // turn-panel spec: a new turn starts a new tree view, with the last 200 steps again
  it('starts a new tree view for a new turn number', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ steps: marked(250) }) });
    const area = region(host).querySelector<HTMLElement>('[tabindex="0"]')!;
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 5_000 });
    Object.defineProperty(area, 'clientHeight', { configurable: true, value: 500 });
    run(() => area.dispatchEvent(new Event('scroll')));
    run(() => button(host, /^Show 50 earlier steps$/)!.click());
    expect(button(host, /earlier step/)).toBeUndefined();
    lastSocket().receive({ type: 'turn', turn: turn({ number: 2, steps: marked(250) }) });
    expect(button(host, /^Show 50 earlier steps$/)).toBeDefined();
  });

  // turn-panel spec: each mount opens a new socket
  it('opens a new socket at each mount', () => {
    mount(<TurnPanel sessionId="s1" />);
    unmountAll();
    mount(<TurnPanel sessionId="s1" />);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
