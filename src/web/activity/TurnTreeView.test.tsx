// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import type { TurnSubagent, TurnTree } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NOW = Date.parse('2026-11-27T10:00:00.000Z');
const minute = (n: number) => new Date(NOW + n * 60_000).toISOString();

const subagent = (id: string, fields: Partial<TurnSubagent> = {}): TurnSubagent => ({ id, type: `type-${id}`, state: 'running', startedAt: new Date(NOW).toISOString(), groups: [], ...fields });
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, groups: [], subagents: [], ...fields });
const oneGroupEach = (subagents: TurnSubagent[]) => turn({ groups: subagents.map((s) => ({ subagents: [s.id] })), subagents });

const card = (host: Element, type: string) => host.querySelector(`article[aria-label="Subagent: ${type}"]`);
const cardTypes = (host: Element) => [...host.querySelectorAll('article')].map((element) => element.getAttribute('aria-label')!.replace('Subagent: ', ''));
const leaf = (host: Element, text: string) => [...host.querySelectorAll('*')].find((element) => element.children.length === 0 && element.textContent === text);
const scrollArea = (host: Element) => host.querySelector<HTMLElement>('[tabindex="0"]')!;
const emptyState = (host: Element) => host.querySelector('.area-state');
const groupOf = (host: Element, type: string) => card(host, type)!.closest('.subagent-group');
/** How many groups hold the row: 1 for level 0. */
const depthOf = (host: Element, type: string) => {
  let depth = 0;
  for (let at = groupOf(host, type); at; at = at.parentElement?.closest('.subagent-group') ?? null) depth += 1;
  return depth;
};
/** The line and the tick drawn beside the row, in its own place of its group. */
const marksOf = (host: Element, type: string) => {
  const member = card(host, type)!.parentElement!;
  return { line: member.querySelector(':scope > .subagent-line') !== null, tick: member.querySelector(':scope > .subagent-tick') !== null };
};
const NO_MARK = { line: false, tick: false };
const MARKED = { line: true, tick: true };

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

  // plan-subagent_panel/REQ-3, REQ-10, REQ-14: the groups in the order of the tree, each one the list of its rows in order
  it('shows the groups in the order of the tree, each one as its own list of rows', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['b'] }, { subagents: ['c', 'a'] }, { subagents: ['d'] }],
          subagents: [subagent('a'), subagent('b'), subagent('c'), subagent('d')],
        })}
      />,
    );
    expect(cardTypes(host)).toEqual(['type-b', 'type-c', 'type-a', 'type-d']);
    expect(groupOf(host, 'type-c'), 'the rows of one group share a list').toBe(groupOf(host, 'type-a'));
    expect(groupOf(host, 'type-b')).not.toBe(groupOf(host, 'type-c'));
    expect(groupOf(host, 'type-d')).not.toBe(groupOf(host, 'type-c'));
  });

  // turn-tree-view spec: an id with no subagent shows nothing
  it('shows nothing for an id with no subagent', () => {
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['ghost', 'a'] }], subagents: [subagent('a')] })} />);
    expect(host.querySelectorAll('article')).toHaveLength(1);
  });

  // plan-subagent_panel/REQ-9: a nested row shows after the row of its parent and before the next row of the parent level, one level deeper
  it('shows the nested rows after the row of their parent, outside it, one level deeper at each depth', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['p', 'q'] }],
          subagents: [subagent('p', { groups: [{ subagents: ['c'] }] }), subagent('c', { groups: [{ subagents: ['g'] }] }), subagent('g', { groups: [{ subagents: ['l3'] }] }), subagent('l3'), subagent('q')],
        })}
      />,
    );
    expect(cardTypes(host)).toEqual(['type-p', 'type-c', 'type-g', 'type-l3', 'type-q']);
    for (const [parent, child] of [
      ['type-p', 'type-c'],
      ['type-c', 'type-g'],
      ['type-g', 'type-l3'],
    ] as const) {
      expect(card(host, parent)!.contains(card(host, child)), `${child} outside the row of ${parent}`).toBe(false);
      expect(depthOf(host, child), `${child} one level deeper than ${parent}`).toBe(depthOf(host, parent) + 1);
    }
    expect(depthOf(host, 'type-q')).toBe(depthOf(host, 'type-p'));
  });

  // plan-subagent_panel/REQ-10, REQ-11, REQ-18: a group of two or more marks each member row; a group of one and the rows nested under a member have no mark
  it('draws a line and a tick beside each member row of a group of two or more, and none beside a row of a group of one', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          groups: [{ subagents: ['solo'] }, { subagents: ['d1', 'd2'] }],
          subagents: [subagent('solo'), subagent('d1', { groups: [{ subagents: ['t'] }] }), subagent('t'), subagent('d2')],
        })}
      />,
    );
    expect(marksOf(host, 'type-solo')).toEqual(NO_MARK);
    expect(marksOf(host, 'type-d1')).toEqual(MARKED);
    expect(marksOf(host, 'type-d2')).toEqual(MARKED);
    expect(marksOf(host, 'type-t'), 'a nested row is no member of the group of its parent').toEqual(NO_MARK);
    expect(host.querySelectorAll('.subagent-tick')).toHaveLength(2);
  });

  // turn-tree-view spec: the line and the ticks are hidden from assistive technologies
  it('hides the line and the ticks from assistive technologies', () => {
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['a', 'b'] }], subagents: [subagent('a'), subagent('b')] })} />);
    const marks = [...host.querySelectorAll('.subagent-line, .subagent-tick')];
    expect(marks).toHaveLength(4);
    for (const mark of marks) expect(mark.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  // turn-tree-view spec: a group counts its shown rows: one row shown → no mark
  it('draws no mark for a group with one shown row', () => {
    const host = mount(<TurnTreeView turn={turn({ groups: [{ subagents: ['ghost', 'a'] }], subagents: [subagent('a')] })} />);
    expect(marksOf(host, 'type-a')).toEqual(NO_MARK);
  });

  // plan-subagent_panel/REQ-15: nothing about turns: no section for earlier turns, no turn state, no turn message
  it('shows only the rows of the groups, with no section and no text about turns', () => {
    const host = mount(<TurnTreeView turn={turn({ number: 4, groups: [{ subagents: ['old-1', 'old-2'] }, { subagents: ['now'] }], subagents: [subagent('old-1'), subagent('old-2'), subagent('now')] })} />);
    expect(cardTypes(host)).toEqual(['type-old-1', 'type-old-2', 'type-now']);
    expect(host.querySelector('section')).toBeNull();
    for (const text of ['Still running from earlier turns', 'Ended', 'No turn yet.', 'No subagents in this turn.', 'No subagents running.']) {
      expect(leaf(host, text), text).toBeUndefined();
    }
    expect(depthOf(host, 'type-old-1')).toBe(1);
    expect(depthOf(host, 'type-now')).toBe(1);
  });

  // plan-session_activity/REQ-45, REQ-46: every subagent of a long turn shows, with no button for hidden items
  it('shows every group of a turn with 300 groups', () => {
    const subagents = Array.from({ length: 300 }, (_, i) => subagent(`s${i}`, { startedAt: minute(i) }));
    const host = mount(<TurnTreeView turn={oneGroupEach(subagents)} />);
    expect(host.querySelectorAll('article')).toHaveLength(300);
    expect(host.querySelector('button:not(.subagent-card-open)')).toBeNull();
  });
});

describe('TurnTreeView, no running subagent', () => {
  // plan-subagent_panel/REQ-20: a tree with no group says "No subagents running.", in a compact empty state
  it('says "No subagents running." for a tree with no group', () => {
    const host = mount(<TurnTreeView turn={turn()} />);
    const state = emptyState(host)!;
    expect(state?.textContent).toBe('No subagents running.');
    expect(state.classList.contains('area-state-empty')).toBe(true);
    expect(state.classList.contains('area-state-compact')).toBe(true);
    expect(host.querySelectorAll('article')).toHaveLength(0);
  });

  // "Empty panel" (plan-subagent_panel/REQ-20): the same message before the first turn, and no other text
  it('says only "No subagents running." before the first turn', () => {
    const host = mount(<TurnTreeView turn={turn({ number: 0 })} />);
    expect(scrollArea(host).textContent).toBe('No subagents running.');
  });

  // plan-subagent_panel/REQ-16, REQ-20: the message leaves with the first group and shows again when the last one leaves
  it('drops the message when a group comes, and shows it again when the last group leaves', () => {
    const host = mount(<TurnTreeView turn={turn()} />);
    rerenderLast(<TurnTreeView turn={oneGroupEach([subagent('a')])} />);
    expect(host.textContent).not.toContain('No subagents running.');
    expect(card(host, 'type-a')).not.toBeNull();
    rerenderLast(<TurnTreeView turn={turn()} />);
    expect(card(host, 'type-a')).toBeNull();
    expect(emptyState(host)?.textContent).toBe('No subagents running.');
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

  // plan-subagent_panel/REQ-19: at first the view follows, and scrolls the least that shows the whole latest card
  it('scrolls at first just enough to show the whole card of the latest started subagent', () => {
    places = { 'type-a': [0, 200], 'type-b': [1_000, 200], 'type-c': [2_000, 200] };
    const host = mount(<TurnTreeView turn={three('b')} />);
    expect(scrollArea(host).scrollTop).toBe(1_200 - VIEW_HEIGHT);
  });

  // plan-subagent_panel/REQ-19: the latest card above the view shows from its top
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

  // plan-subagent_panel/REQ-19: the latest started subagent counts at any level, nested ones too
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

  // plan-subagent_panel/REQ-19: a user scroll up stops the following; a scroll down short of the end does not resume it
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

  // plan-subagent_panel/REQ-19: a user scroll to the end (within 8 px) starts the following again
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
