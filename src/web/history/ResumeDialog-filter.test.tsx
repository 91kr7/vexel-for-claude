// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumeDialog } from './ResumeDialog';

interface PastSession {
  id: string;
  label: string;
  lastActivity: string;
  runningElsewhere: boolean;
  favorite?: true;
}

const ALPHA = '/work/alpha';
const BETA = '/work/beta';
const GAMMA = '/work/gamma';

const DEFAULT_GROUPS = [
  {
    folder: ALPHA,
    available: true,
    sessions: [
      { id: 'a-fav', label: 'Fix login page', lastActivity: '2026-11-10T10:00:00.000Z', runningElsewhere: false, favorite: true },
      { id: 'a-plain', label: 'Fix logout page', lastActivity: '2026-11-09T10:00:00.000Z', runningElsewhere: false },
    ],
  },
  {
    folder: BETA,
    available: true,
    sessions: [{ id: 'b-plain', label: 'Write docs', lastActivity: '2026-11-08T10:00:00.000Z', runningElsewhere: false }],
  },
  {
    folder: GAMMA,
    available: true,
    sessions: [
      { id: 'g-fav', label: 'Refactor parser', lastActivity: '2026-11-07T10:00:00.000Z', runningElsewhere: false, favorite: true },
      { id: 'g-fav-2', label: 'Tune cache', lastActivity: '2026-11-06T10:00:00.000Z', runningElsewhere: false, favorite: true },
    ],
  },
] satisfies { folder: string; available: boolean; sessions: PastSession[] }[];

interface Call {
  url: string;
  method: string;
}

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function stubFetch(groups: unknown) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.endsWith('/api/past-sessions') && method === 'GET') return new Response(JSON.stringify(groups), { status: 200, headers: { 'content-type': 'application/json' } });
      if (/\/favorite$/.test(url)) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ id: 'new-hosted' }), { status: 201, headers: { 'content-type': 'application/json' } });
    }),
  );
  return calls;
}

async function open(groups: unknown = DEFAULT_GROUPS) {
  const calls = stubFetch(groups);
  const onResumed = vi.fn();
  const onCancel = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ResumeDialog onResumed={onResumed} onCancel={onCancel} />));
  await settle();
  await settle();
  return { calls, onResumed, onCancel, root };
}

const buttonNamed = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name);
const toggle = () => buttonNamed('Only Favorites')!;
const search = () => document.querySelector<HTMLInputElement>('input[aria-label="Search Past Sessions"]')!;
const radios = () => [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
const nameOf = (radio: HTMLInputElement) =>
  (radio.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
    .trim();
const visibleLabels = () => radios().map(nameOf);
const radioOf = (label: string) => radios().find((r) => nameOf(r) === label)!;
const sections = () => [...document.querySelectorAll('section')].map((s) => s.getAttribute('aria-label'));
const radiogroup = () => document.querySelector('[role="radiogroup"]');
const resumeButton = () => buttonNamed('Resume')!;
const dialogText = () => document.querySelector('[role="dialog"]')?.textContent ?? '';
const nonListRequests = (calls: Call[]) => calls.filter((c) => !(c.url.endsWith('/api/past-sessions') && c.method === 'GET'));

function type(text: string) {
  const input = search();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  flushSync(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const pressToggle = () => flushSync(() => toggle().click());

/** The star of the row of `label`: the first "Remove Favorite"/"Mark as Favorite" button after its radio. */
function starOf(label: string) {
  const radio = radioOf(label);
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => /^(Mark as Favorite|Remove Favorite)$/.test(b.getAttribute('aria-label') ?? '') && radio.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  )!;
}

describe('ResumeDialog favorites filter', () => {
  // plan-resume_favorites/REQ-10, REQ-13, REQ-18, REQ-19
  it('opens with the toggle "Only Favorites" off, unfocused, with its tooltip, and the search bar focused', async () => {
    await open();
    expect(toggle()).toBeDefined();
    expect(toggle().getAttribute('title')).toBe('Only Favorites');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().type).toBe('button');
    expect(document.activeElement).toBe(search());
    expect(visibleLabels()).toHaveLength(5);
  });

  // plan-resume_favorites/REQ-10, REQ-11: toggle on with an empty search shows every favorite and hides empty groups
  it('turned on, it shows only the favorite sessions and hides the groups with none', async () => {
    const { calls } = await open();
    pressToggle();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(visibleLabels()).toEqual(['Fix login page', 'Refactor parser', 'Tune cache']);
    expect(sections()).toEqual([ALPHA, GAMMA]);
    expect(nonListRequests(calls)).toHaveLength(0);
  });

  // plan-resume_favorites/REQ-11: favorite AND search match on the label
  it('with search text, it shows only the favorites whose label matches', async () => {
    await open();
    pressToggle();
    type('FIX');
    expect(visibleLabels()).toEqual(['Fix login page']);
    expect(sections()).toEqual([ALPHA]);
  });

  // plan-resume_favorites/REQ-11: favorite AND search match on the folder path
  it('with search text matching a folder, it shows only the favorites of that folder', async () => {
    await open();
    pressToggle();
    type('gamma');
    expect(visibleLabels()).toEqual(['Refactor parser', 'Tune cache']);
  });

  // plan-resume_favorites/REQ-12: off again → the search rule alone
  it('turned off again, it shows every row that matches the text', async () => {
    await open();
    type('fix');
    pressToggle();
    expect(visibleLabels()).toEqual(['Fix login page']);
    pressToggle();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(visibleLabels()).toEqual(['Fix login page', 'Fix logout page']);
  });

  // plan-resume_favorites/REQ-15, REQ-19
  it('turned on with no favorite at all and an empty search, it shows "No favorite sessions." and no radiogroup', async () => {
    await open([DEFAULT_GROUPS[1]]);
    pressToggle();
    expect(radios()).toHaveLength(0);
    expect(radiogroup()).toBeNull();
    expect(dialogText()).toContain('No favorite sessions.');
  });

  // plan-resume_favorites/REQ-15, REQ-19
  it('turned on with search text no favorite matches, it shows the favorite no-match message', async () => {
    await open();
    pressToggle();
    type('docs');
    expect(radios()).toHaveLength(0);
    expect(radiogroup()).toBeNull();
    expect(dialogText()).toContain('No favorite sessions match "docs".');
  });

  // plan-resume_favorites/REQ-12: the old no-match message stays with the toggle off
  it('turned off, a search with no match keeps the old message', async () => {
    await open();
    type('zzz');
    expect(dialogText()).toContain('No sessions match "zzz".');
    expect(dialogText()).not.toContain('favorite');
  });

  // ResumeDialog "Shows": with no past session at all the old empty state stays, also with the toggle on
  it('with no past session at all, it keeps "No sessions to resume." with the toggle on', async () => {
    await open([]);
    pressToggle();
    expect(dialogText()).toContain('No sessions to resume.');
    expect(dialogText()).not.toContain('No favorite sessions');
  });

  // ResumeDialog "Actions": the toggle hides the selected session → no selection, "Resume" disabled
  it('turning it on clears the selection of a non-favorite session, and turning it off does not restore it', async () => {
    await open();
    flushSync(() => radioOf('Write docs').click());
    expect(resumeButton().disabled).toBe(false);
    pressToggle();
    expect(resumeButton().disabled).toBe(true);
    pressToggle();
    expect(radioOf('Write docs').checked).toBe(false);
    expect(radios().filter((r) => r.checked)).toHaveLength(0);
    expect(resumeButton().disabled).toBe(true);
  });

  // ResumeDialog "Actions": a selected favorite stays visible, so it stays selected
  it('turning it on keeps the selection of a favorite session', async () => {
    await open();
    flushSync(() => radioOf('Tune cache').click());
    pressToggle();
    expect(radioOf('Tune cache').checked).toBe(true);
    expect(resumeButton().disabled).toBe(false);
  });

  // plan-resume_favorites/REQ-14
  it('unmarking a row with the toggle on removes it from the list and keeps the others', async () => {
    await open();
    pressToggle();
    starOf('Refactor parser').click();
    await settle();
    expect(visibleLabels()).toEqual(['Fix login page', 'Tune cache']);
  });

  // ResumeDialog "Actions": unmarking the selected row with the toggle on clears the selection
  it('unmarking the selected row with the toggle on clears the selection and disables "Resume"', async () => {
    await open();
    pressToggle();
    flushSync(() => radioOf('Tune cache').click());
    starOf('Tune cache').click();
    await settle();
    expect(visibleLabels()).not.toContain('Tune cache');
    expect(radios().filter((r) => r.checked)).toHaveLength(0);
    expect(resumeButton().disabled).toBe(true);
  });

  // plan-resume_favorites/REQ-16: the state shows by the star shape, not by colour alone
  it('draws a different star when on and when off', async () => {
    await open();
    const off = toggle().querySelector('svg')?.outerHTML;
    pressToggle();
    const on = toggle().querySelector('svg')?.outerHTML;
    expect(off).toBeDefined();
    expect(on).toBeDefined();
    expect(on).not.toBe(off);
  });

  // plan-resume_favorites/REQ-17: Enter on the toggle does not resume the selected session
  it('Enter on the toggle does not resume the selected session', async () => {
    const { calls, onResumed } = await open();
    flushSync(() => radioOf('Tune cache').click());
    toggle().focus();
    toggle().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    expect(calls.filter((c) => /\/resume$/.test(c.url))).toHaveLength(0);
    expect(onResumed).not.toHaveBeenCalled();
  });

  // plan-resume_favorites/REQ-17, ResumeDialog "Tab": search bar, "Clear Search" when shown, "Only Favorites", then the list
  it('sits in the Tab order after the search bar and "Clear Search", before the list', async () => {
    await open();
    type('page');
    const clear = buttonNamed('Clear Search')!;
    const firstRadio = radios()[0]!;
    expect(toggle().tabIndex).toBeGreaterThanOrEqual(0);
    expect(search().compareDocumentPosition(clear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clear.compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle().compareDocumentPosition(firstRadio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // plan-resume_favorites/REQ-13: the state is not kept between openings
  it('is off again at the next opening', async () => {
    const first = await open();
    pressToggle();
    flushSync(() => first.root.unmount());
    roots.splice(roots.indexOf(first.root), 1);
    document.body.innerHTML = '';
    await open();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(visibleLabels()).toHaveLength(5);
  });
});
