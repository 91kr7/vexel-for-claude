// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import type { TurnSubagent, TurnTree } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NOW = Date.parse('2026-11-27T10:00:00.000Z');
const minute = (n: number) => new Date(NOW + n * 60_000).toISOString();

const subagent = (id: string, fields: Partial<TurnSubagent> = {}): TurnSubagent => ({ id, type: `type-${id}`, state: 'running', startedAt: new Date(NOW).toISOString(), groups: [], ...fields });
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, status: 'running', groups: [], earlier: [], subagents: [], ...fields });
const oneGroupEach = (subagents: TurnSubagent[]) => turn({ groups: subagents.map((s) => ({ subagents: [s.id] })), subagents });

const card = (host: Element, type: string) => host.querySelector(`article[aria-label="Subagent: ${type}"]`);
const cardTypes = (host: Element) => [...host.querySelectorAll('article')].map((element) => element.getAttribute('aria-label')!.replace('Subagent: ', ''));
const leaf = (host: Element, text: string) => [...host.querySelectorAll('*')].find((element) => element.children.length === 0 && element.textContent === text);
const isBefore = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
const scrollArea = (host: Element) => host.querySelector<HTMLElement>('[tabindex="0"]')!;
const emptyState = (host: Element) => host.querySelector('.area-state');

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TurnTreeView, content', () => {
  // plan-session_activity/REQ-47: the tree area is in the Tab order
  it('puts the scrolling area in the Tab order', () => {
    const host = mount(<TurnTreeView turn={oneGroupEach([subagent('a')])} />);
    expect(scrollArea(host)).not.toBeNull();
    expect(scrollArea(host).contains(card(host, 'type-a'))).toBe(true);
  });

  // plan-subagent_panel/REQ-2, REQ-3: the groups one under the other in the order of the tree, each group as one grid of its cards in order
  it('shows the groups in the order of the tree, each one as its own grid', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['b'] }, { subagents: ['c', 'a'] }, { subagents: ['d'] }],
          subagents: [subagent('a'), subagent('b'), subagent('c'), subagent('d')],
        })}
      />,
    );
    expect(cardTypes(host)).toEqual(['type-b', 'type-c', 'type-a', 'type-d']);
    const gridOf = (type: string) => card(host, type)!.parentElement!;
    expect(gridOf('type-c'), 'the cards of one group share a grid').toBe(gridOf('type-a'));
    expect(gridOf('type-b')).not.toBe(gridOf('type-c'));
    expect(gridOf('type-d')).not.toBe(gridOf('type-c'));
  });

  // turn-tree-view spec: an id with no subagent shows nothing
  it('shows nothing for an id with no subagent', () => {
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['ghost', 'a'] }], subagents: [subagent('a')] })} />);
    expect(host.querySelectorAll('article')).toHaveLength(1);
  });

  // plan-session_activity/REQ-38: a nested group shows inside the card of the parent
  it('shows the nested groups inside the card of the parent', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['p'] }],
          subagents: [subagent('p', { groups: [{ subagents: ['c'] }] }), subagent('c', { groups: [{ subagents: ['g'] }] }), subagent('g')],
        })}
      />,
    );
    const parent = card(host, 'type-p')!;
    const child = card(host, 'type-c')!;
    expect(parent.contains(child)).toBe(true);
    expect(child.contains(card(host, 'type-g'))).toBe(true);
  });

  // plan-session_activity/REQ-39: the running subagents of earlier turns in their own section, above the groups of the turn
  it('shows the subagents of earlier turns in the section "Still running from earlier turns", above the groups', () => {
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['now'] }], earlier: [{ subagents: ['old'] }], subagents: [subagent('old'), subagent('now')] })} />);
    const section = leaf(host, 'Still running from earlier turns')!.closest('section')!;
    expect(section).not.toBeNull();
    expect(section.contains(card(host, 'type-old'))).toBe(true);
    expect(section.contains(card(host, 'type-now'))).toBe(false);
    expect(isBefore(section, card(host, 'type-now')!)).toBe(true);
  });

  // plan-session_activity/REQ-39: no section without earlier subagents
  it('shows no earlier section when no subagent of an earlier turn runs', () => {
    const host = mount(<TurnTreeView turn={oneGroupEach([subagent('a')])} />);
    expect(host.textContent).not.toContain('Still running from earlier turns');
  });

  // plan-session_activity/REQ-45, REQ-46: every subagent of a long turn shows, with no button for hidden items
  it('shows every group of a turn with 300 groups', () => {
    const subagents = Array.from({ length: 300 }, (_, i) => subagent(`s${i}`, { startedAt: minute(i) }));
    const host = mount(<TurnTreeView turn={oneGroupEach(subagents)} />);
    expect(host.querySelectorAll('article')).toHaveLength(300);
    expect(host.querySelector('button:not(.subagent-card-open)')).toBeNull();
  });
});

describe('TurnTreeView, turn with no subagents', () => {
  // plan-subagent_panel/REQ-5: a turn with no group says so, in a compact empty state
  it('says "No subagents in this turn." for a turn with no group', () => {
    const host = mount(<TurnTreeView turn={turn()} />);
    const state = emptyState(host)!;
    expect(state?.textContent).toBe('No subagents in this turn.');
    expect(state.classList.contains('area-state-empty')).toBe(true);
    expect(state.classList.contains('area-state-compact')).toBe(true);
  });

  // plan-subagent_panel/REQ-5: the message concerns the current turn, so it shows also under the earlier section
  it('shows the message under the section of earlier turns', () => {
    const host = mount(<TurnTreeView turn={turn({ earlier: [{ subagents: ['old'] }], subagents: [subagent('old')] })} />);
    const section = leaf(host, 'Still running from earlier turns')!.closest('section')!;
    expect(emptyState(host)?.textContent).toBe('No subagents in this turn.');
    expect(section.contains(emptyState(host))).toBe(false);
    expect(isBefore(section, emptyState(host)!)).toBe(true);
  });

  // plan-subagent_panel/REQ-5: the message shows also for an ended turn
  it('shows the message for an ended turn', () => {
    const host = mount(<TurnTreeView turn={turn({ status: 'ended' })} />);
    expect(host.textContent).toContain('No subagents in this turn.');
  });

  // plan-subagent_panel/REQ-5: no message once the turn has a group
  it('shows no message when the turn has a group, and drops it when the first group comes', () => {
    const host = mount(<TurnTreeView turn={turn()} />);
    rerenderLast(<TurnTreeView turn={oneGroupEach([subagent('a')])} />);
    expect(host.textContent).not.toContain('No subagents in this turn.');
    expect(card(host, 'type-a')).not.toBeNull();
  });
});

describe('TurnTreeView, following the latest started subagent', () => {
  const VIEW_TOP = 100;
  const VIEW_HEIGHT = 500;
  let contentHeight = 3_000;
  let places: Record<string, [top: number, height: number]> = {};

  const rect = (top: number, height: number) => ({ x: 0, y: top, top, bottom: top + height, left: 0, right: 300, width: 300, height, toJSON: () => ({}) }) as DOMRect;
  const isArea = (element: Element) => element.getAttribute('tabindex') === '0';

  /** jsdom has no layout: each card sits at a fixed place of the content, the area shows VIEW_HEIGHT px of it from its scrollTop. */
  beforeEach(() => {
    contentHeight = 3_000;
    places = {};
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return isArea(this) ? VIEW_HEIGHT : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return isArea(this) ? contentHeight : 0;
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (isArea(this)) return rect(VIEW_TOP, VIEW_HEIGHT);
      const place = places[this.getAttribute('aria-label')?.replace('Subagent: ', '') ?? ''];
      const area = this.closest<HTMLElement>('[tabindex="0"]');
      return place && area ? rect(VIEW_TOP + place[0] - area.scrollTop, place[1]) : rect(0, 0);
    });
  });

  function userScroll(host: Element, scrollTop: number): void {
    const area = scrollArea(host);
    area.scrollTop = scrollTop;
    run(() => area.dispatchEvent(new Event('scroll')));
  }

  const three = (latest: string) =>
    turn({
      groups: [{ subagents: ['a'] }, { subagents: ['b'] }, { subagents: ['c'] }],
      subagents: ['a', 'b', 'c'].map((id) => subagent(id, { startedAt: minute(id === latest ? 9 : 1) })),
    });

  // plan-subagent_panel/REQ-4: at first the view follows, and scrolls the least that shows the whole latest card
  it('scrolls at first just enough to show the whole card of the latest started subagent', () => {
    places = { 'type-a': [0, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    expect(scrollArea(host).scrollTop).toBe(1_200 - VIEW_HEIGHT);
  });

  // plan-subagent_panel/REQ-4: the latest card above the view shows from its top
  it('scrolls up to the top of the latest card when it is above the view', () => {
    places = { 'type-a': [100, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('c')} />);
    expect(scrollArea(host).scrollTop).toBe(2_200 - VIEW_HEIGHT);
    rerenderLast(<TurnTreeView turn={three('a')} />);
    expect(scrollArea(host).scrollTop).toBe(100);
  });

  // turn-tree-view spec: a latest card that shows whole does not move the view
  it('does not move when the whole latest card already shows', () => {
    places = { 'type-a': [100, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('a')} />);
    expect(scrollArea(host).scrollTop).toBe(0);
    rerenderLast(<TurnTreeView turn={three('a')} />);
    expect(scrollArea(host).scrollTop).toBe(0);
  });

  // turn-tree-view spec: a card taller than the view shows from its top
  it('shows a card taller than the view from its top', () => {
    places = { 'type-a': [0, 200], 'type-b': [1_000, 800], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    expect(scrollArea(host).scrollTop).toBe(1_000);
  });

  // plan-subagent_panel/REQ-4: the latest started subagent counts at any level, nested ones too
  it('follows a nested subagent when it started last', () => {
    places = { 'type-p': [0, 1_500], 'type-child': [1_200, 200], 'type-q': [2_000, 200] };
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['p'] }, { subagents: ['q'] }],
          subagents: [subagent('p', { startedAt: minute(1), groups: [{ subagents: ['child'] }] }), subagent('child', { startedAt: minute(8) }), subagent('q', { startedAt: minute(5) })],
        })}
      />,
    );
    expect(scrollArea(host).scrollTop).toBe(1_400 - VIEW_HEIGHT);
  });

  // turn-tree-view spec: the latest started subagent counts also when it runs from an earlier turn
  it('follows a subagent of the earlier section when it started last', () => {
    places = { 'type-old': [600, 200], 'type-now': [1_000, 200] };
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['now'] }], earlier: [{ subagents: ['old'] }], subagents: [subagent('old', { startedAt: minute(9) }), subagent('now', { startedAt: minute(1) })] })} />);
    expect(scrollArea(host).scrollTop).toBe(800 - VIEW_HEIGHT);
  });

  // turn-tree-view spec: a subagent with no valid start does not count
  it('skips the subagents with no valid start', () => {
    places = { 'type-a': [600, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const subagents = [subagent('a', { startedAt: minute(1) }), subagent('b', { startedAt: undefined }), subagent('c', { startedAt: 'not a time' })];
    const host = mount(<TurnTreeView turn={oneGroupEach(subagents)} />);
    expect(scrollArea(host).scrollTop).toBe(800 - VIEW_HEIGHT);
  });

  // turn-tree-view spec: no latest started subagent → the view does not move
  it('does not move when no subagent has a start', () => {
    places = { 'type-a': [1_000, 200] };
    const host = mount(<TurnTreeView turn={oneGroupEach([subagent('a', { startedAt: undefined })])} />);
    expect(scrollArea(host).scrollTop).toBe(0);
  });

  // turn-tree-view spec: on equal starts the latest is the one later in subagents
  it('takes the subagent later in the list on equal starts', () => {
    places = { 'type-a': [1_000, 200], 'type-b': [2_000, 200] };
    const host = mount(<TurnTreeView turn={oneGroupEach([subagent('a', { startedAt: minute(3) }), subagent('b', { startedAt: minute(3) })])} />);
    expect(scrollArea(host).scrollTop).toBe(2_200 - VIEW_HEIGHT);
  });

  // plan-subagent_panel/REQ-4: a user scroll up stops the following; a scroll down short of the end does not resume it
  it('stays still after the user scrolled up, also after a scroll down short of the end', () => {
    places = { 'type-a': [100, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    expect(scrollArea(host).scrollTop).toBe(700);
    userScroll(host, 300);
    rerenderLast(<TurnTreeView turn={three('c')} />);
    expect(scrollArea(host).scrollTop).toBe(300);
    userScroll(host, 1_200);
    rerenderLast(<TurnTreeView turn={three('a')} />);
    expect(scrollArea(host).scrollTop).toBe(1_200);
  });

  // plan-subagent_panel/REQ-4: a user scroll to the end (within 8 px) starts the following again
  it('follows again after the user scrolled back to the end', () => {
    places = { 'type-a': [100, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    userScroll(host, 300);
    userScroll(host, contentHeight - VIEW_HEIGHT - 8);
    rerenderLast(<TurnTreeView turn={three('a')} />);
    expect(scrollArea(host).scrollTop).toBe(100);
  });

  // turn-tree-view spec: the view's own scrolls and the moves of the content do not stop the following
  it('keeps following after its own scroll and after a move of the content', () => {
    places = { 'type-a': [100, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    const area = scrollArea(host);
    run(() => area.dispatchEvent(new Event('scroll')));
    rerenderLast(<TurnTreeView turn={three('c')} />);
    expect(area.scrollTop).toBe(1_700);
    contentHeight = 2_000;
    area.scrollTop = contentHeight - VIEW_HEIGHT;
    run(() => area.dispatchEvent(new Event('scroll')));
    rerenderLast(<TurnTreeView turn={three('a')} />);
    expect(area.scrollTop).toBe(100);
  });
});
