// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumeDialog } from './ResumeDialog';

const ERROR = 'Could not change the favorite mark.';
const FOLDER = '/work/alpha';

const groups = [
  {
    folder: FOLDER,
    available: true,
    sessions: [
      { id: 'plain-1', label: 'Plain one', lastActivity: '2026-11-10T10:00:00.000Z', runningElsewhere: false },
      { id: 'marked-1', label: 'Marked one', lastActivity: '2026-11-09T10:00:00.000Z', runningElsewhere: false, favorite: true },
      { id: 'plain-2', label: 'Plain two', lastActivity: '2026-11-08T10:00:00.000Z', runningElsewhere: false },
    ],
  },
];

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Answers the list with `groups` and every favorite request with `favoriteStatus`. */
function stubFetch(favoriteStatus: number | 'network-error' = 204) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/api/past-sessions') && method === 'GET') return new Response(JSON.stringify(groups), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/\/favorite$/.test(url)) {
      if (favoriteStatus === 'network-error') throw new TypeError('Failed to fetch');
      return new Response(favoriteStatus === 204 ? null : '', { status: favoriteStatus });
    }
    return new Response(JSON.stringify({ id: 'new-hosted' }), { status: 201, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetch);
  return calls;
}

async function open(favoriteStatus: number | 'network-error' = 204) {
  const calls = stubFetch(favoriteStatus);
  const onResumed = vi.fn();
  const onCancel = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ResumeDialog onResumed={onResumed} onCancel={onCancel} />));
  await settle();
  await settle();
  return { calls, onResumed, onCancel };
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const radios = () => [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
const radioOf = (label: string) => radios().find((r) => accessibleName(r) === label)!;
const textOfIds = (ids: string | null) =>
  (ids ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ');
const accessibleName = (radio: HTMLInputElement) => textOfIds(radio.getAttribute('aria-labelledby')) || radio.getAttribute('aria-label') || '';
const description = (radio: HTMLInputElement) => textOfIds(radio.getAttribute('aria-describedby'));
const stars = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => /^(Mark as Favorite|Remove Favorite)$/.test(b.getAttribute('aria-label') ?? ''));
/** The star that follows the radio of `label` in document order, before the next radio. */
const starOf = (label: string) => {
  const radio = radioOf(label);
  const next = radios()[radios().indexOf(radio) + 1];
  return stars().find(
    (star) =>
      radio.compareDocumentPosition(star) & Node.DOCUMENT_POSITION_FOLLOWING && (!next || star.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING),
  )!;
};
const favoriteRequests = (calls: Call[]) => calls.filter((c) => /\/favorite$/.test(c.url));
const resumeRequests = (calls: Call[]) => calls.filter((c) => /\/resume$/.test(c.url));
const resumeButton = () => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Resume')!;

describe('ResumeDialog favorite mark', () => {
  // plan-resume_favorites/REQ-5: each row offers the mark action, named after the current mark
  it('shows one star per row: "Mark as Favorite" when not marked, "Remove Favorite" when marked', async () => {
    await open();
    expect(radios()).toHaveLength(3);
    expect(stars()).toHaveLength(3);
    expect(starOf('Plain one').getAttribute('aria-label')).toBe('Mark as Favorite');
    expect(starOf('Marked one').getAttribute('aria-label')).toBe('Remove Favorite');
    expect(starOf('Plain two').getAttribute('aria-label')).toBe('Mark as Favorite');
  });

  // ResumeDialog "Shows": the star is outside the radio's label, so the label does not name it and it does not choose the row
  it('places each star outside the label of its radio', async () => {
    await open();
    for (const star of stars()) expect(star.closest('label')).toBeNull();
    expect(accessibleName(radioOf('Plain one'))).toBe('Plain one');
  });

  // ResumeDialog "Shows": the radio of a marked session is described by "Favorite", read on open
  it('describes the radio of the marked session by "Favorite", and only that one', async () => {
    await open();
    expect(description(radioOf('Marked one'))).toMatch(/\bFavorite\b/);
    expect(description(radioOf('Plain one'))).not.toMatch(/\bFavorite\b/);
  });

  // plan-resume_favorites/REQ-5: the press goes to PastSessionFavoriteRoute with the opposite mark
  it.each([
    ['Plain one', 'plain-1', true],
    ['Marked one', 'marked-1', false],
  ])('a press on the star of "%s" sends PUT /api/past-sessions/%s/favorite with favorite %s', async (label, id, sent) => {
    const { calls } = await open();
    starOf(label).click();
    await settle();
    const requests = favoriteRequests(calls);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toMatch(new RegExp(`/api/past-sessions/${id}/favorite$`));
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.body).toEqual({ favorite: sent });
  });

  // plan-resume_favorites/REQ-7: after a 2xx the row's star and "Favorite" description flip at once
  it('marks the row at once after a 2xx, then unmarks it on the next press', async () => {
    await open();
    starOf('Plain one').click();
    await settle();
    expect(starOf('Plain one').getAttribute('aria-label')).toBe('Remove Favorite');
    expect(starOf('Plain one').classList.contains('marked')).toBe(true);
    expect(description(radioOf('Plain one'))).toMatch(/\bFavorite\b/);
    expect(starOf('Plain two').getAttribute('aria-label')).toBe('Mark as Favorite');

    starOf('Plain one').click();
    await settle();
    expect(starOf('Plain one').getAttribute('aria-label')).toBe('Mark as Favorite');
    expect(description(radioOf('Plain one'))).not.toMatch(/\bFavorite\b/);
  });

  // plan-resume_favorites/REQ-6: the press does not resume, does not close and does not select
  it('a press keeps the dialog open, sends no resume and selects no row', async () => {
    const { calls, onResumed, onCancel } = await open();
    starOf('Plain one').click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(onResumed).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(resumeRequests(calls)).toHaveLength(0);
    expect(radios().filter((r) => r.checked)).toHaveLength(0);
    expect(resumeButton().disabled).toBe(true);
  });

  // ResumeDialog "Actions": the selected row stays the same after a press on another row's star
  it('keeps the selected row when the star of another row is pressed', async () => {
    await open();
    flushSync(() => radioOf('Plain two').click());
    expect(radioOf('Plain two').checked).toBe(true);
    starOf('Plain one').click();
    await settle();
    expect(radioOf('Plain two').checked).toBe(true);
    expect(radioOf('Plain one').checked).toBe(false);
    expect(resumeButton().disabled).toBe(false);
  });

  // plan-resume_favorites/REQ-6, REQ-9: Enter on a star does not resume the selected session
  it('Enter on a star does not resume the selected session', async () => {
    const { calls, onResumed } = await open();
    flushSync(() => radioOf('Plain two').click());
    const star = starOf('Plain one');
    star.focus();
    star.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle();
    expect(resumeRequests(calls)).toHaveLength(0);
    expect(onResumed).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  // plan-resume_favorites/REQ-9: each star is a native button in the Tab order
  it('each star is a native button of type "button" that Tab reaches', async () => {
    await open();
    for (const star of stars()) {
      expect(star.type).toBe('button');
      expect(star.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  // ResumeDialog "Actions": a failure keeps the star and shows the error under the row
  it.each([500, 404, 'network-error'] as const)('after a failure (%s) the row keeps its star and shows the error under it', async (status) => {
    const { calls } = await open(status);
    starOf('Plain one').click();
    await settle();
    expect(favoriteRequests(calls)).toHaveLength(1);
    expect(starOf('Plain one').getAttribute('aria-label')).toBe('Mark as Favorite');
    expect(description(radioOf('Plain one'))).not.toMatch(/\bFavorite\b/);
    const alerts = [...document.querySelectorAll('[role="alert"]')].filter((a) => a.textContent?.trim() === ERROR);
    expect(alerts).toHaveLength(1);
    const alert = alerts[0]!;
    expect(radioOf('Plain one').compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(radioOf('Marked one')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dialog()).not.toBeNull();
  });
});
