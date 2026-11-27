// @vitest-environment jsdom
// Unit tests of the subagent conversation inside TurnPanel, plan-session_activity, batch subagent-conversation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket, socketsOn } from '../external/conversation-test-support';
import { mount, run, unmountAll } from '../settings/settings-test-support';
import type { TurnSubagent, TurnTree } from './turn-store';
import { TurnPanel } from './TurnPanel';

const sub = (id: string, type: string, fields: Partial<TurnSubagent> = {}): TurnSubagent => ({ id, type, description: `${type} task`, state: 'running', groups: [], ...fields });
const parent = sub('agent-p', 'Parent', { groups: [{ subagents: ['agent-c'] }] });
const child = sub('agent-c', 'Child');
const old = sub('agent-e', 'Earlier');
const tree = (fields: Partial<TurnTree> = {}): TurnTree => ({
  number: 1,
  status: 'running',
  groups: [{ subagents: ['agent-p'] }],
  earlier: ['agent-e'],
  subagents: [parent, child, old],
  ...fields,
});

const turnSocket = () => socketsOn('/api/sessions/s1/turn')[0]!;
const conversationSockets = () => FakeWebSocket.instances.filter((socket) => socket.url.includes('/subagents/'));
const panel = (host: Element) => host.querySelector<HTMLElement>('section[aria-label="Turn Panel"]')!;
const conversation = (host: Element) => panel(host).querySelector<HTMLElement>('section[aria-label="Subagent Conversation"]');
const openButton = (host: Element, type: string) => panel(host).querySelector<HTMLButtonElement>(`button[aria-label="Open Conversation: ${type}"]`);
const backButton = (host: Element) => [...conversation(host)!.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === 'Back')!;
const treeArea = (host: Element) => panel(host).querySelector<HTMLElement>('[tabindex="0"]');
const textOf = (element: Element | null) => element?.textContent ?? '';

function openPanel(): HTMLElement {
  const host = mount(<TurnPanel sessionId="s1" />);
  turnSocket().receive({ type: 'turn', turn: tree() });
  return host;
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

describe('TurnPanel, subagent conversation', () => {
  // plan-session_activity/REQ-49, REQ-53: a card opens the conversation of its subagent below the header; the tree stays in the page
  it('shows the conversation of the clicked subagent below the header, and keeps the tree in the page', () => {
    const host = openPanel();
    const area = treeArea(host)!;
    run(() => openButton(host, 'Parent')!.click());
    expect(conversation(host)).not.toBeNull();
    expect(textOf(panel(host))).toContain('Current Turn');
    expect(conversationSockets().map((socket) => new URL(socket.url).pathname)).toEqual(['/api/sessions/s1/subagents/agent-p/conversation']);
    expect(area.isConnected, 'the tree is kept, with its scroll place').toBe(true);
    expect(textOf(conversation(host))).toContain('Parent task');
    expect(document.activeElement).toBe(backButton(host));
  });

  // plan-session_activity/REQ-54, REQ-55: "Back" returns to the same tree, with the focus on the button of the card that opened it
  it('returns to the same tree on "Back", with the focus on the opener', () => {
    const host = openPanel();
    const area = treeArea(host)!;
    const opener = openButton(host, 'Parent')!;
    run(() => opener.click());
    run(() => backButton(host).click());
    expect(conversation(host)).toBeNull();
    expect(treeArea(host)).toBe(area);
    expect(document.activeElement).toBe(opener);
    expect(conversationSockets()[0]!.closedByPage, 'the conversation socket closes').toBe(true);
  });

  // plan-session_activity/REQ-54, REQ-55: Esc returns to the tree too
  it('returns to the tree on Esc, with the focus on the opener', () => {
    const host = openPanel();
    const opener = openButton(host, 'Parent')!;
    run(() => opener.click());
    run(() => backButton(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(conversation(host)).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  // turn-tree-view spec: every card of the tree opens its conversation, nested and earlier ones included, and a nested card opens only its own
  it('opens the conversation of a nested card and of an earlier card, each with its own subagent', () => {
    const host = openPanel();
    run(() => openButton(host, 'Child')!.click());
    expect(conversationSockets().map((socket) => new URL(socket.url).pathname)).toEqual(['/api/sessions/s1/subagents/agent-c/conversation']);
    expect(textOf(conversation(host))).toContain('Child task');
    run(() => backButton(host).click());
    run(() => openButton(host, 'Earlier')!.click());
    expect(new URL(conversationSockets().at(-1)!.url).pathname).toBe('/api/sessions/s1/subagents/agent-e/conversation');
    expect(textOf(conversation(host))).toContain('Earlier task');
  });

  // turn-panel spec: the bar shows the subagent as it is in the current tree
  it('shows the subagent of the current tree in the bar', () => {
    const host = openPanel();
    run(() => openButton(host, 'Parent')!.click());
    turnSocket().receive({ type: 'update', subagents: [{ ...parent, state: 'finished', description: 'Parent task, revised' }] });
    expect(textOf(conversation(host))).toContain('Finished');
    expect(textOf(conversation(host))).toContain('Parent task, revised');
  });

  // turn-panel spec: the conversation stays open in a new turn, the bar keeps the last values, and "Back" focuses the tree area when the opener is gone
  it('stays open when a new turn starts, keeps the last values, and on "Back" focuses the tree area when the opener is gone', () => {
    const host = openPanel();
    run(() => openButton(host, 'Parent')!.click());
    turnSocket().receive({ type: 'turn', turn: tree({ number: 2, groups: [], earlier: [], subagents: [] }) });
    expect(conversation(host)).not.toBeNull();
    expect(textOf(conversation(host))).toContain('Parent task');
    expect(textOf(conversation(host))).toContain('Parent');
    expect(conversationSockets(), 'the same conversation socket').toHaveLength(1);
    run(() => backButton(host).click());
    expect(conversation(host)).toBeNull();
    expect(openButton(host, 'Parent')).toBeNull();
    expect(document.activeElement).toBe(treeArea(host));
  });

  // turn-panel spec: a new mount shows the tree, with no conversation open
  it('shows the tree with no conversation at a new mount', () => {
    const host = openPanel();
    run(() => openButton(host, 'Parent')!.click());
    unmountAll();
    const again = mount(<TurnPanel sessionId="s1" />);
    FakeWebSocket.instances.at(-1)!.receive({ type: 'turn', turn: tree() });
    expect(conversation(again)).toBeNull();
    expect(openButton(again, 'Parent')).not.toBeNull();
  });
});
