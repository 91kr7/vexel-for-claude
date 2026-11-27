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
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, groups: [], subagents: [], ...fields });
const subagent = (id: string, startedAt: string): TurnSubagent => ({ id, type: `type-${id}`, state: 'running', startedAt, groups: [] });
const withGroups = (ids: string[], fields: Partial<TurnTree> = {}) =>
  turn({ groups: ids.map((id) => ({ subagents: [id] })), subagents: ids.map((id, i) => subagent(id, `2026-11-26T09:0${i}:00.000Z`)), ...fields });
const region = (host: Element) => host.querySelector('section[aria-label="Subagents"]')!;
const header = (host: Element) => region(host).querySelector('header')!;
/** The deepest element whose whole text is `text`. */
const leaf = (host: Element, text: string) =>
  [...host.querySelectorAll('*')].find((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));
const TURN_TEXTS = ['Ended', 'No turn yet.', 'No subagents in this turn.', 'Still running from earlier turns', 'Current Turn', 'Turn Panel', 'Turn not available.'];

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
  // plan-subagent_panel/REQ-21: a region "Subagents" titled "Subagents", reading the tree of its session
  it('is a region "Subagents" titled "Subagents" that opens the turn route of its session', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    expect(region(host)).not.toBeNull();
    expect(header(host).textContent?.trim()).toBe('Subagents');
    expect(lastSocket().url).toMatch(/\/api\/sessions\/s1\/turn$/);
  });

  // turn-panel spec: "Loading…" before the first frame, "Subagents not available." when the socket closes before it
  it('says "Loading…" before the first frame and "Subagents not available." when the socket closes before it', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    expect(region(host).textContent).toContain('Loading…');
    lastSocket().serverClose();
    expect(leaf(region(host), 'Subagents not available.')).toBeDefined();
    expect(region(host).textContent).not.toContain('Loading…');
    expect(region(host).textContent).not.toContain('Turn not available.');
  });

  // plan-subagent_panel/REQ-15, REQ-20: before the first turn → "No subagents running.", with no turn text and no status chip
  it('says "No subagents running." before the first turn, with nothing about turns', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: turn({ number: 0 }) });
    expect(leaf(region(host), 'No subagents running.')).toBeDefined();
    for (const text of [...TURN_TEXTS, 'Running']) expect(leaf(host, text), text).toBeUndefined();
  });

  // plan-subagent_panel/REQ-15: the header shows only "Subagents", with no status chip, while subagents run
  it('shows only the title in the header, and the tree of the running subagents', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: withGroups(['a']) });
    expect(header(host).textContent?.trim()).toBe('Subagents');
    expect(header(host).querySelectorAll('*:not(h1, h2, h3, h4)')).toHaveLength(0);
    expect(region(host).querySelector('article[aria-label="Subagent: type-a"]')).not.toBeNull();
    for (const text of TURN_TEXTS) expect(leaf(host, text), text).toBeUndefined();
  });

  // plan-subagent_panel/REQ-16, REQ-20: when the last subagent leaves, "No subagents running." and no "Ended" mark
  it('says "No subagents running." with no "Ended" mark once the last subagent left', () => {
    const host = mount(<TurnPanel sessionId="s1" />);
    lastSocket().receive({ type: 'turn', turn: withGroups(['a']) });
    lastSocket().receive({ type: 'update', groups: [] });
    expect(region(host).querySelector('article')).toBeNull();
    expect(leaf(region(host), 'No subagents running.')).toBeDefined();
    for (const text of TURN_TEXTS) expect(leaf(host, text), text).toBeUndefined();
  });

  describe('across turns', () => {
    const top = (element: Element) => Number(element.getAttribute('aria-label')?.match(/type-s(\d+)/)?.[1] ?? -1) * 1_000;
    const area = (host: Element) => region(host).querySelector<HTMLElement>('[tabindex="0"]')!;

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(5_000);
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const scroller = this.closest<HTMLElement>('[tabindex="0"]');
        const y = this === scroller ? 0 : top(this) >= 0 && scroller ? top(this) - scroller.scrollTop : 0;
        const height = this === scroller ? 500 : top(this) >= 0 ? 200 : 0;
        return { x: 0, y, top: y, bottom: y + height, left: 0, right: 300, width: 300, height, toJSON: () => ({}) } as DOMRect;
      });
    });

    // plan-subagent_panel/REQ-19: while the view follows, a new turn with a new subagent scrolls to it, in the same tree view
    it('keeps the same tree view at a new turn number and scrolls to the new latest subagent', () => {
      const host = mount(<TurnPanel sessionId="s1" />);
      lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2']) });
      const before = area(host);
      expect(before.scrollTop).toBe(2_200 - 500);
      lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2', 's3'], { number: 2 }) });
      expect(area(host)).toBe(before);
      expect(area(host).scrollTop).toBe(3_200 - 500);
    });

    // plan-subagent_panel/REQ-19: after the user scrolled up, a new turn with a new subagent does not move the view
    it('stays where the user scrolled up when a new turn brings a new subagent', () => {
      const host = mount(<TurnPanel sessionId="s1" />);
      lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2']) });
      area(host).scrollTop = 100;
      run(() => area(host).dispatchEvent(new Event('scroll')));
      lastSocket().receive({ type: 'turn', turn: withGroups(['s0', 's1', 's2', 's3'], { number: 2 }) });
      expect(area(host).scrollTop).toBe(100);
    });
  });

  // turn-panel spec: each mount opens a new socket
  it('opens a new socket at each mount', () => {
    mount(<TurnPanel sessionId="s1" />);
    unmountAll();
    mount(<TurnPanel sessionId="s1" />);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
