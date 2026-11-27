// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import type { TurnSubagent, TurnTree } from './turn-store';
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
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, status: 'running', groups: [], earlier: [], subagents: [], ...fields });
const subagent = (id: string, startedAt: string): TurnSubagent => ({ id, type: `type-${id}`, state: 'running', startedAt, groups: [] });
const withGroups = (ids: string[], fields: Partial<TurnTree> = {}) =>
  turn({ groups: ids.map((id) => ({ subagents: [id] })), subagents: ids.map((id, i) => subagent(id, `2026-11-26T09:0${i}:00.000Z`)), ...fields });
const region = (host: Element) => host.querySelector('section[aria-label="Turn Panel"]')!;
/** The deepest element whose whole text is `text`. */
const leaf = (host: Element, text: string) =>
  [...host.querySelectorAll('*')].find((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-11-26T10:00:00.000Z') });
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  // plan-session_activity/REQ-28, REQ-40, plan-subagent_panel/REQ-6: the chip "Running" while the turn runs, "Ended" once it ended, and the tree
  it('shows the chip "Running", then "Ended", with the tree of the turn', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: withGroups(['a'], { subagents: [{ ...subagent('a', '2026-11-26T09:00:00.000Z'), state: 'finished' }] }) });
    expect(leaf(host, 'Running')).toBeDefined();
    expect(region(host).querySelector('article[aria-label="Subagent: type-a"]')).not.toBeNull();
    lastSocket().receive({ type: 'update', status: 'ended' });
    expect(leaf(host, 'Ended')).toBeDefined();
    expect(leaf(host, 'Running')).toBeUndefined();
    expect(region(host).querySelector('article[aria-label="Subagent: type-a"]')).not.toBeNull();
  });

  // plan-subagent_panel/REQ-5, REQ-6: an ended turn with no subagents keeps the chip "Ended" and says it has no subagents
  it('shows "Ended" and "No subagents in this turn." for an ended turn with no subagents', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ number: 4, status: 'ended' }) });
    expect(leaf(host, 'Ended')).toBeDefined();
    expect(leaf(region(host), 'No subagents in this turn.')).toBeDefined();
    expect(region(host).textContent).not.toContain('No turn yet.');
  });

  // turn-panel spec, plan-subagent_panel/REQ-4: a new turn starts a new tree view, which follows again after the user scrolled up
  it('starts a new tree view, following again, for a new turn number', () => {
    const top = (element: Element) => Number(element.getAttribute('aria-label')?.match(/type-s(\d+)/)?.[1] ?? -1) * 1_000;
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(5_000);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const area = this.closest<HTMLElement>('[tabindex="0"]');
      const y = this === area ? 0 : top(this) >= 0 && area ? top(this) - area.scrollTop : 0;
      const height = this === area ? 500 : top(this) >= 0 ? 200 : 0;
      return { x: 0, y, top: y, bottom: y + height, left: 0, right: 300, width: 300, height, toJSON: () => ({}) } as DOMRect;
    });
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2']) });
    const area = () => region(host).querySelector<HTMLElement>('[tabindex="0"]')!;
    expect(area().scrollTop).toBe(2_200 - 500);
    area().scrollTop = 100;
    run(() => area().dispatchEvent(new Event('scroll')));
    lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2', 's3'], { number: 2 }) });
    expect(area().scrollTop).toBe(3_200 - 500);
  });

  // turn-panel spec: each mount opens a new socket
  it('opens a new socket at each mount', () => {
    mount(<TurnPanel sessionId="s1" />);
    unmountAll();
    mount(<TurnPanel sessionId="s1" />);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
