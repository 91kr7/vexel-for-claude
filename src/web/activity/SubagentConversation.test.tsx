// @vitest-environment jsdom
// Unit tests of SubagentConversation, plan-session_activity, batch subagent-conversation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket, settle, socketsOn, stubContentRoute } from '../external/conversation-test-support';
import { keydown, mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import { SubagentConversation } from './SubagentConversation';
import type { TurnSubagent } from './turn-store';

const STREAM_END = '/api/sessions/s1/subagents/agent-a1/conversation';
const subagent = (fields: Partial<TurnSubagent> = {}): TurnSubagent => ({
  id: 'agent-a1',
  type: 'sdd-tester',
  description: 'Run the tests of the batch',
  state: 'running',
  groups: [],
  ...fields,
});
const region = (host: Element) => host.querySelector<HTMLElement>('section[aria-label="Subagent Conversation"]');
const nameOf = (element: Element) => (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
const back = (host: Element) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => nameOf(button) === 'Back');
/** The deepest element whose whole text is `text`. */
const leaf = (host: Element, text: string) =>
  [...host.querySelectorAll('*')].find((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

describe('SubagentConversation', () => {
  // plan-session_activity/REQ-49: a region with a bar ("Back", type, description, state) on the conversation route of the subagent
  it('is a region with "Back", the type, the description and the state, reading the conversation of its subagent', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={() => {}} />);
    const view = region(host)!;
    expect(view).not.toBeNull();
    expect(back(view)).toBeDefined();
    expect(leaf(view, 'sdd-tester')?.getAttribute('title')).toBe('sdd-tester');
    expect(leaf(view, 'Run the tests of the batch')?.getAttribute('title')).toBe('Run the tests of the batch');
    expect(leaf(view, 'Running')).toBeDefined();
    expect(socketsOn(STREAM_END)).toHaveLength(1);
  });

  // subagent-conversation spec: no type → no chip; the bar follows the changes of the subagent
  it('shows no type chip for a subagent with no type, and follows its state', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent({ type: undefined })} onBack={() => {}} />);
    expect(region(host)!.querySelector('.mono-chip')).toBeNull();
    rerenderLast(<SubagentConversation sessionId="s1" subagent={subagent({ type: undefined, state: 'finished' })} onBack={() => {}} />);
    expect(leaf(region(host)!, 'Finished')).toBeDefined();
    rerenderLast(<SubagentConversation sessionId="s1" subagent={subagent({ type: undefined, state: 'stopped' })} onBack={() => {}} />);
    expect(leaf(region(host)!, 'Stopped')).toBeDefined();
    expect(leaf(region(host)!, 'Finished')).toBeUndefined();
  });

  // plan-subagent_panel/REQ-22, subagent-conversation spec: with leftList the bar keeps type and description and shows no state pill
  it('shows no state pill once the subagent left the list, and keeps its type and description', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} leftList onBack={() => {}} />);
    const view = region(host)!;
    for (const state of ['Running', 'Finished', 'Stopped']) expect(leaf(view, state), state).toBeUndefined();
    expect(view.querySelector('.status-pill')).toBeNull();
    expect(leaf(view, 'sdd-tester')).toBeDefined();
    expect(leaf(view, 'Run the tests of the batch')).toBeDefined();
    expect(back(view)).toBeDefined();
    rerenderLast(<SubagentConversation sessionId="s1" subagent={subagent()} leftList={false} onBack={() => {}} />);
    expect(leaf(region(host)!, 'Running')).toBeDefined();
    expect(socketsOn(STREAM_END), 'the same conversation stays open').toHaveLength(1);
  });

  // plan-session_activity/REQ-49, REQ-50: the user items come from the parent agent, named "Task" with the avatar "T"
  it('names the user items "Task" with the avatar "T", from the task on', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={() => {}} />);
    socketsOn(STREAM_END)[0]!.receive({ type: 'items', items: [{ kind: 'user', text: 'Run the tests of the batch' }, { kind: 'assistant', text: 'Running them' }] });
    const tasks = [...host.querySelectorAll('article[aria-label="Task"]')];
    expect(tasks).toHaveLength(1);
    expect(leaf(tasks[0]!, 'T')).toBeDefined();
    expect(tasks[0]!.textContent).toContain('Run the tests of the batch');
    expect(host.querySelector('article[aria-label="You"]')).toBeNull();
    expect(host.querySelector('article[aria-label="Claude"]')?.textContent).toContain('Running them');
  });

  // plan-session_activity/REQ-50: the full content of a tool card comes from the item route of the subagent
  it('loads the full output of a cut tool result from the item route of the subagent', async () => {
    const route = stubContentRoute(() => 'r1\nr2\nr3\nr4\nr5\nr6');
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={() => {}} />);
    socketsOn(STREAM_END)[0]!.receive({ type: 'items', items: [{ kind: 'tool_result', text: 'r1\nr2\nr3\nr4\nr5', truncated: true, ref: { offset: 42, block: 0 } }] });
    run(() => host.querySelector<HTMLButtonElement>('[aria-label^="Tool: "] button[aria-expanded]')!.click());
    await settle();
    expect(route.requested()).toEqual(['/api/sessions/s1/subagents/agent-a1/items?offset=42&block=0']);
    expect(host.querySelector('[aria-label^="Tool: "]')!.textContent).toContain('r6');
  });

  // plan-session_activity/REQ-55: on mount the focus goes to "Back"
  it('puts the focus on "Back" when it opens', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={() => {}} />);
    expect(document.activeElement).toBe(back(host));
  });

  // plan-session_activity/REQ-54: "Back" returns to the tree
  it('calls onBack when "Back" is clicked', () => {
    const onBack = vi.fn();
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={onBack} />);
    run(() => back(host)!.click());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // plan-session_activity/REQ-54, REQ-55: Esc inside the region acts as "Back", and the key goes no further
  it('calls onBack on Esc inside the region, from "Back" and from the messages, and the key goes no further', () => {
    const onBack = vi.fn();
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    try {
      const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={onBack} />);
      socketsOn(STREAM_END)[0]!.receive({ type: 'items', items: [{ kind: 'assistant', text: 'Running them' }] });
      keydown(back(host)!, 'Escape');
      keydown(host.querySelector('article[aria-label="Claude"]')!, 'Escape');
      expect(onBack).toHaveBeenCalledTimes(2);
      expect(outside).not.toHaveBeenCalled();
      keydown(document.body, 'Escape');
      expect(onBack, 'Esc outside the region').toHaveBeenCalledTimes(2);
    } finally {
      document.removeEventListener('keydown', outside);
    }
  });

  // subagent-conversation spec: no input field, it sends nothing; unmount closes the socket
  it('has no input field, sends nothing, and closes its socket on unmount', () => {
    const host = mount(<SubagentConversation sessionId="s1" subagent={subagent()} onBack={() => {}} />);
    const socket = socketsOn(STREAM_END)[0]!;
    socket.receive({ type: 'items', items: [{ kind: 'user', text: 'Task text' }] });
    expect(region(host)!.querySelector('input, textarea, select, [contenteditable="true"]')).toBeNull();
    expect(socket.sent).toEqual([]);
    unmountAll();
    expect(socket.closedByPage).toBe(true);
  });
});
