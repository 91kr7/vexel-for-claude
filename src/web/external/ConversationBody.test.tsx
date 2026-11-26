// @vitest-environment jsdom
// Unit tests of ConversationBody, batch subagent-conversation: the props that let a subagent conversation reuse the body.
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import { ConversationBody } from './ConversationBody';
import { FakeWebSocket, settle, stubContentRoute } from './conversation-test-support';

const STREAM = '/api/streams/one/conversation';
const CONTENT = '/api/streams/one/items';
const lastSocket = () => FakeWebSocket.instances.at(-1)!;
const articles = (host: Element, name: string) => [...host.querySelectorAll(`article[aria-label="${name}"]`)];
/** The deepest element whose whole text is `text`. */
const leaf = (host: Element, text: string) =>
  [...host.querySelectorAll('*')].find((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));
const toolRow = (host: Element, name: string) => host.querySelector(`[aria-label="Tool: ${name}"]`)?.querySelector<HTMLButtonElement>('button[aria-expanded]');

const userItem = { kind: 'user', text: 'Do the task' };
const claudeItem = { kind: 'assistant', text: 'On it' };
const SEVEN = 'o1\no2\no3\no4\no5\no6\no7';

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

describe('ConversationBody', () => {
  // conversation-body spec: the stream path on the host of the page, ws: on an http: page; "Loading…" before the first frame
  it('opens the stream path on the host of the page and says "Loading…" before the first frame', () => {
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} />);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(lastSocket().url).toBe(`ws://${window.location.host}${STREAM}`);
    expect(host.textContent).toContain('Loading…');
  });

  // conversation-body spec: user items named "You" with the avatar "U" by default, Claude items named "Claude"
  it('names the user items "You" with the avatar "U" by default', () => {
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} />);
    lastSocket().receive({ type: 'items', items: [userItem, claudeItem] });
    const [user] = articles(host, 'You');
    expect(user).toBeDefined();
    expect(leaf(user!, 'You')).toBeDefined();
    expect(leaf(user!, 'U')).toBeDefined();
    expect(user!.textContent).toContain('Do the task');
    expect(articles(host, 'Claude')).toHaveLength(1);
  });

  // conversation-body spec: `userName` and `userAvatar` name the user items
  it('names the user items with userName and userAvatar', () => {
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} userName="Task" userAvatar="T" />);
    lastSocket().receive({ type: 'items', items: [userItem, claudeItem, { kind: 'user', text: 'Another message' }] });
    const users = articles(host, 'Task');
    expect(users).toHaveLength(2);
    expect(leaf(users[0]!, 'Task')).toBeDefined();
    expect(leaf(users[0]!, 'T')).toBeDefined();
    expect(articles(host, 'You')).toHaveLength(0);
    expect(articles(host, 'Claude')).toHaveLength(1);
  });

  // conversation-body spec: the full content comes from `contentPath` with the offset and block of the ref, input first, then output
  it('loads the full input and the full output of an opened card from the content path', async () => {
    const route = stubContentRoute((request) => (request.includes('offset=10') ? '{\n  "command": "npm test",\n  "cwd": "/repo"\n}' : SEVEN));
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} />);
    lastSocket().receive({
      type: 'items',
      items: [
        { kind: 'tool_call', name: 'Bash', summary: 'npm test', moreInput: true, id: 'b1', ref: { offset: 10, block: 1 } },
        { kind: 'tool_result', text: 'o1\no2\no3\no4\no5', truncated: true, toolUseId: 'b1', ref: { offset: 99, block: 0 } },
      ],
    });
    expect(route.fetchMock).not.toHaveBeenCalled();
    run(() => toolRow(host, 'Bash')!.click());
    await settle();
    expect(route.requested().sort()).toEqual([`${CONTENT}?offset=10&block=1`, `${CONTENT}?offset=99&block=0`]);
    const card = host.querySelector('[aria-label="Tool: Bash"]')!;
    const text = card.textContent ?? '';
    expect(text).toContain('"cwd": "/repo"');
    expect(text).toContain('o7');
    expect(text.indexOf('"cwd"'), 'the input before the output').toBeLessThan(text.indexOf('o7'));
  });

  // conversation-body spec: `focusRef` puts the focus in the message area, which is not in the Tab order
  it('puts the focus in the message area through focusRef, an area out of the Tab order', () => {
    const focusRef = createRef<{ focus(): void }>();
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} focusRef={focusRef} />);
    lastSocket().receive({ type: 'items', items: [userItem, claudeItem] });
    run(() => focusRef.current!.focus());
    const area = document.activeElement as HTMLElement;
    expect(host.contains(area)).toBe(true);
    expect(area.tabIndex).toBe(-1);
    expect(area.querySelectorAll('article').length, 'the area holds the messages').toBe(2);
  });

  // conversation-body spec: a new streamPath closes the socket and opens one on the new path; unmount closes it
  it('closes its socket and opens one on a new stream path, and closes it on unmount', () => {
    mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} />);
    const first = lastSocket();
    rerenderLast(<ConversationBody streamPath="/api/streams/two/conversation" contentPath="/api/streams/two/items" />);
    expect(first.closedByPage).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(lastSocket().url).toMatch(/\/api\/streams\/two\/conversation$/);
    const second = lastSocket();
    unmountAll();
    expect(second.closedByPage).toBe(true);
  });

  // conversation-body spec: a socket closed before the first frame → "Conversation not available."; it sends nothing
  it('says "Conversation not available." when the socket closes before the first frame, and sends nothing', () => {
    const host = mount(<ConversationBody streamPath={STREAM} contentPath={CONTENT} />);
    lastSocket().serverClose(4404);
    expect(host.textContent).toContain('Conversation not available.');
    expect(host.textContent).not.toContain('Loading…');
    expect(FakeWebSocket.instances.every((socket) => socket.sent.length === 0)).toBe(true);
    expect(host.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
  });
});
