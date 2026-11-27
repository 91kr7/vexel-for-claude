// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, rerenderLast, run, unmountAll } from '../settings/settings-test-support';
import type { TurnStep, TurnSubagent, TurnTree } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NOW = Date.parse('2026-11-26T10:00:00.000Z');

const marked = (count: number, from = 0): TurnStep[] => Array.from({ length: count }, (_, i) => ({ kind: 'text', text: `[s${from + i}]` }));
const subagent = (id: string, fields: Partial<TurnSubagent> = {}): TurnSubagent => ({ id, type: `type-${id}`, state: 'running', startedAt: new Date(NOW).toISOString(), groups: [], ...fields });
const turn = (fields: Partial<TurnTree> = {}): TurnTree => ({ number: 1, status: 'running', groups: [], earlier: [], subagents: [], ...fields });

const shownMarks = (host: Element) => [...(host.textContent ?? '').matchAll(/\[s(\d+)\]/g)].map((match) => Number(match[1]));
const card = (host: Element, type: string) => host.querySelector(`article[aria-label="Subagent: ${type}"]`);
const leaf = (host: Element, text: string) => [...host.querySelectorAll('*')].find((element) => element.children.length === 0 && element.textContent === text);
const isBefore = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
const button = (host: Element, name: RegExp) => [...host.querySelectorAll('button')].find((element) => name.test(element.textContent ?? ''));
const scrollArea = (host: Element) => host.querySelector<HTMLElement>('[tabindex="0"]')!;

/** jsdom has no layout: gives the area a size and a scroll position, as the user's scroll would. */
function scrolledTo(host: Element, scrollTop: number): HTMLElement {
  const area = scrollArea(host);
  Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 5_000 });
  Object.defineProperty(area, 'clientHeight', { configurable: true, value: 500 });
  area.scrollTop = scrollTop;
  run(() => area.dispatchEvent(new Event('scroll')));
  return area;
}

/** The user scrolls to the top and clicks the button for the earlier steps. */
function showEarlier(host: Element, name: RegExp): void {
  scrolledTo(host, 0);
  run(() => button(host, name)!.click());
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
});

describe('TurnTreeView, steps', () => {
  // plan-session_activity/REQ-29, REQ-30: the steps in order; a tool step with name, argument (tooltip) and outcome
  it('shows the steps in order, each tool step with its name, argument and outcome', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          steps: [
            { kind: 'text', text: 'Checking the repository' },
            { kind: 'tool', name: 'Bash', argument: 'git status', outcome: 'completed' },
            { kind: 'tool', name: 'Read', argument: '/src/main.ts', outcome: 'running' },
            { kind: 'tool', name: 'Bash', argument: 'false', outcome: 'error' },
          ],
        })}
      />,
    );
    const text = host.textContent!;
    const positions = ['Checking the repository', 'git status', 'Completed', '/src/main.ts', 'Running', 'false', 'Error'].map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0), text).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(leaf(host, 'Bash')).toBeDefined();
    expect(host.querySelector('[title="git status"]')?.textContent).toBe('git status');
  });

  // plan-session_activity/REQ-44: a tool step with no name, argument or outcome shows the rest, with no placeholder text
  it('shows no text for a missing name, argument or outcome', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: [{ kind: 'tool' }, { kind: 'tool', name: 'TodoWrite' }] })} />);
    expect(host.textContent).toContain('TodoWrite');
    expect(host.textContent).not.toMatch(/undefined|Running|Completed|Error/);
  });

  // plan-session_activity/REQ-47: the tree area is in the Tab order
  it('puts the scrolling area in the Tab order', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(3) })} />);
    expect(scrollArea(host)).not.toBeNull();
    expect(shownMarks(scrollArea(host))).toEqual([0, 1, 2]);
  });
});

describe('TurnTreeView, subagent groups', () => {
  // plan-session_activity/REQ-31, REQ-37: a group shows right under its step, its cards in the group order
  it('shows a group right under its step, with its cards in order', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          steps: marked(4),
          groups: [{ step: 2, subagents: ['b', 'a'] }],
          subagents: [subagent('a'), subagent('b')],
        })}
      />,
    );
    const a = card(host, 'type-a')!;
    const b = card(host, 'type-b')!;
    expect(isBefore(leaf(host, '[s2]')!, b)).toBe(true);
    expect(isBefore(b, a)).toBe(true);
    expect(isBefore(a, leaf(host, '[s3]')!)).toBe(true);
  });

  // turn-tree-view spec: an id with no subagent shows nothing
  it('shows nothing for an id with no subagent', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(2), groups: [{ step: 0, subagents: ['ghost', 'a'] }], subagents: [subagent('a')] })} />);
    expect(host.querySelectorAll('article')).toHaveLength(1);
  });

  // plan-session_activity/REQ-38: a nested group shows inside the card of its parent
  it('shows the nested groups inside the card of the parent', () => {
    const host = mount(
      <TurnTreeView
        turn={turn({
          steps: marked(1),
          groups: [{ step: 0, subagents: ['p'] }],
          subagents: [subagent('p', { groups: [{ step: 3, subagents: ['c'] }] }), subagent('c', { groups: [{ step: 0, subagents: ['g'] }] }), subagent('g')],
        })}
      />,
    );
    const parent = card(host, 'type-p')!;
    const child = card(host, 'type-c')!;
    expect(parent.contains(child)).toBe(true);
    expect(child.contains(card(host, 'type-g'))).toBe(true);
  });

  // plan-session_activity/REQ-39: the running subagents of earlier turns in their own section, at the top
  it('shows the subagents of earlier turns in the section "Still running from earlier turns", above the steps', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(2), earlier: ['old'], subagents: [subagent('old')] })} />);
    const title = leaf(host, 'Still running from earlier turns')!;
    const section = title.closest('section')!;
    expect(section).not.toBeNull();
    expect(section.contains(card(host, 'type-old'))).toBe(true);
    expect(isBefore(section, leaf(host, '[s0]')!)).toBe(true);
  });

  // plan-session_activity/REQ-39: no section without earlier subagents
  it('shows no earlier section when no subagent of an earlier turn runs', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(2) })} />);
    expect(host.textContent).not.toContain('Still running from earlier turns');
  });
});

describe('TurnTreeView, long turns', () => {
  // plan-session_activity/REQ-45: the last 200 steps, and a button for the hidden ones, at most 200 at a time
  it('shows the last 200 steps and "Show N earlier steps" for at most 200 more', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(450) })} />);
    expect(shownMarks(host)).toEqual(Array.from({ length: 200 }, (_, i) => 250 + i));
    showEarlier(host, /^Show 200 earlier steps$/);
    expect(shownMarks(host)).toHaveLength(400);
    expect(shownMarks(host)[0]).toBe(50);
    showEarlier(host, /^Show 50 earlier steps$/);
    expect(shownMarks(host)).toHaveLength(450);
    expect(button(host, /earlier step/)).toBeUndefined();
  });

  // turn-tree-view spec: one hidden step → "Show 1 earlier step"
  it('says "Show 1 earlier step" for one hidden step', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(201) })} />);
    expect(button(host, /^Show 1 earlier step$/)).toBeDefined();
  });

  // turn-tree-view spec: a group shows only with its step
  it('shows a group only when its step shows', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(250), groups: [{ step: 10, subagents: ['early'] }], subagents: [subagent('early')] })} />);
    expect(card(host, 'type-early')).toBeNull();
    showEarlier(host, /^Show 50 earlier steps$/);
    expect(card(host, 'type-early')).not.toBeNull();
  });

  // plan-session_activity/REQ-42, REQ-45: while the view follows the end, new steps show the last 200 again
  it('shows the last 200 steps again when new steps come while the view is at the end', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(250) })} />);
    showEarlier(host, /^Show 50 earlier steps$/);
    expect(shownMarks(host)).toHaveLength(250);
    scrolledTo(host, 4_500);
    rerenderLast(<TurnTreeView turn={turn({ steps: marked(260) })} />);
    expect(shownMarks(host)).toEqual(Array.from({ length: 200 }, (_, i) => 60 + i));
  });

  // plan-session_activity/REQ-42: scrolled up, the shown steps stay, the new ones add at the bottom, and the view does not move
  it('keeps the shown steps and its scroll position when new steps come after the user scrolled up', () => {
    const host = mount(<TurnTreeView turn={turn({ steps: marked(250) })} />);
    const area = scrolledTo(host, 100);
    rerenderLast(<TurnTreeView turn={turn({ steps: marked(260) })} />);
    expect(shownMarks(host)).toEqual(Array.from({ length: 210 }, (_, i) => 50 + i));
    expect(button(host, /^Show 50 earlier steps$/)).toBeDefined();
    expect(area.scrollTop).toBe(100);
  });
});
