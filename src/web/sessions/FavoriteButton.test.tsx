// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from './FavoriteButton';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const ERROR = 'Could not change the favorite mark.';

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(sessionId: string, favorite: boolean, hidden?: boolean) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const render = (value: boolean, hide = hidden) => flushSync(() => root.render(<FavoriteButton sessionId={sessionId} favorite={value} hidden={hide} />));
  render(favorite);
  const button = () => host.querySelector('button')!;
  return { host, button, render };
}

/** A fetch stub whose answers the test gives, in order. */
function controlledFetch() {
  const answers: { resolve: (response: Response) => void; reject: (error: unknown) => void }[] = [];
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        answers.push({ resolve, reject });
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return { fetch, answers };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const alertText = (host: HTMLElement) => host.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
const pops = (button: HTMLButtonElement) => button.classList.contains('pop');
// jsdom has no AnimationEvent, so React listens to the prefixed name there.
const endAnimation = (button: HTMLButtonElement) =>
  flushSync(() => ['animationend', 'webkitAnimationEnd'].forEach((name) => button.dispatchEvent(new Event(name, { bubbles: true }))));

describe('FavoriteButton', () => {
  // plan-favorite_session/REQ-1, REQ-12, plan-ui_restyle/REQ-28: name, tooltip and outline star of an unmarked session
  it('is named "Mark as Favorite", with the same tooltip and an outline star, when not marked', () => {
    const { button } = mount('a', false);
    expect(button().getAttribute('aria-label')).toBe('Mark as Favorite');
    expect(button().getAttribute('title')).toBe('Mark as Favorite');
    expect(button().querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  // plan-favorite_session/REQ-5, REQ-12, plan-ui_restyle/REQ-28: name, tooltip and filled star of a marked session
  it('is named "Remove Favorite", with the same tooltip and a filled star, when marked', () => {
    const { button } = mount('a', true);
    expect(button().getAttribute('aria-label')).toBe('Remove Favorite');
    expect(button().getAttribute('title')).toBe('Remove Favorite');
    expect(button().querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  // plan-favorite_session/REQ-13, plan-ui_restyle/REQ-30: a native button, so Enter and Space press it and Tab reaches it
  it('is a native button of type "button", not removed from the tab order', () => {
    const { button } = mount('a', false);
    expect(button().type).toBe('button');
    expect(button().getAttribute('tabindex')).toBeNull();
  });

  // plan-ui_restyle/REQ-30: the shared star classes of the project star, marked only when favorite
  it.each([
    [false, false],
    [true, true],
  ])('with favorite %s it is a star-button placed by entry-favorite, marked %s', (favorite, marked) => {
    const { button } = mount('a', favorite);
    expect(button().classList.contains('star-button')).toBe(true);
    expect(button().classList.contains('entry-favorite')).toBe(true);
    expect(button().classList.contains('marked')).toBe(marked);
  });

  it('is not busy and shows no error at the start', () => {
    const { host, button } = mount('a', false);
    expect(button().hasAttribute('aria-busy')).toBe(false);
    expect(button().hasAttribute('aria-disabled')).toBe(false);
    expect(alertText(host)).toBeNull();
  });

  // FavoriteButton prop: hidden hides the button and its error
  it('hides the button and its error with the prop hidden', async () => {
    const { answers } = controlledFetch();
    const { host, button, render } = mount('a', false);
    button().click();
    answers[0]!.resolve(new Response('', { status: 500 }));
    await settle();
    expect(alertText(host)).toBe(ERROR);
    render(false, true);
    expect(button().hidden).toBe(true);
    expect(alertText(host)).toBeNull();
  });

  // plan-ui_restyle/REQ-33: the request is unchanged
  it.each([
    [false, true],
    [true, false],
  ])('with favorite %s, a press sends PUT /api/sessions/:id/favorite with favorite %s', async (favorite, sent) => {
    const { fetch, answers } = controlledFetch();
    const { button } = mount('id/1', favorite);
    button().click();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/sessions\/id%2F1\/favorite$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ favorite: sent });
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
  });

  // FavoriteButton rule: the state comes from the props; any 2xx answer is a success
  it.each([204, 200])('%i shows no error and does not change the mark by itself', async (status) => {
    const { answers } = controlledFetch();
    const { host, button } = mount('a', false);
    button().click();
    answers[0]!.resolve(new Response(status === 204 ? null : '', { status }));
    await settle();
    expect(alertText(host)).toBeNull();
    expect(button().getAttribute('aria-label')).toBe('Mark as Favorite');
    expect(button().classList.contains('marked')).toBe(false);
  });

  it('while the request runs it is aria-disabled and aria-busy, and a press sends nothing more', async () => {
    const { fetch, answers } = controlledFetch();
    const { button } = mount('a', false);
    button().click();
    await settle();
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().getAttribute('aria-busy')).toBe('true');
    button().click();
    expect(fetch).toHaveBeenCalledTimes(1);
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(button().hasAttribute('aria-disabled')).toBe(false);
    expect(button().hasAttribute('aria-busy')).toBe(false);
  });

  // plan-ui_restyle/REQ-33: the error is unchanged
  it.each([
    ['a 500 answer', (answer: { resolve: (r: Response) => void }) => answer.resolve(new Response('', { status: 500 }))],
    ['a 404 answer', (answer: { resolve: (r: Response) => void }) => answer.resolve(new Response('{"error":"session_not_found"}', { status: 404 }))],
    ['a network error', (answer: { reject: (e: unknown) => void }) => answer.reject(new TypeError('Failed to fetch'))],
  ])('shows "Could not change the favorite mark." after %s', async (_name, fail) => {
    const { answers } = controlledFetch();
    const { host, button } = mount('a', false);
    button().click();
    fail(answers[0]! as never);
    await settle();
    expect(alertText(host)).toBe(ERROR);
  });

  it('a new press clears the error', async () => {
    const { answers } = controlledFetch();
    const { host, button } = mount('a', false);
    button().click();
    answers[0]!.reject(new TypeError('Failed to fetch'));
    await settle();
    button().click();
    await settle();
    expect(alertText(host)).toBeNull();
    answers[1]!.resolve(new Response(null, { status: 204 }));
    await settle();
  });

  // FavoriteButton "Shows": no pop on mount
  it('does not pop on mount of a marked session', () => {
    expect(pops(mount('a', true).button())).toBe(false);
  });

  // plan-ui_restyle/REQ-30 (as REQ-17): a mark press, then the mark arriving, pops once
  it('pops when favorite turns true after its own mark press, and stops at the end of the animation', async () => {
    const { answers } = controlledFetch();
    const { button, render } = mount('a', false);
    button().click();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(pops(button())).toBe(false);
    render(true);
    expect(pops(button())).toBe(true);
    endAnimation(button());
    expect(pops(button())).toBe(false);
  });

  it('pops when the mark arrives while its own mark request still runs', async () => {
    const { answers } = controlledFetch();
    const { button, render } = mount('a', false);
    button().click();
    render(true);
    expect(pops(button())).toBe(true);
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
  });

  it('does not pop again when the mark goes off and on from elsewhere after a popped mark', async () => {
    const { answers } = controlledFetch();
    const { button, render } = mount('a', false);
    button().click();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    render(true);
    endAnimation(button());
    render(false);
    render(true);
    expect(pops(button())).toBe(false);
  });

  // FavoriteButton "Shows": no pop when the mark comes from elsewhere
  it('does not pop when favorite turns true with no press of this button', () => {
    const { button, render } = mount('a', false);
    render(true);
    expect(pops(button())).toBe(false);
  });

  it('does not pop on unmark', async () => {
    const { answers } = controlledFetch();
    const { button, render } = mount('a', true);
    button().click();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    render(false);
    expect(pops(button())).toBe(false);
  });

  it('does not pop after a failed mark request, even when the mark later comes from elsewhere', async () => {
    const { answers } = controlledFetch();
    const { button, render } = mount('a', false);
    button().click();
    answers[0]!.resolve(new Response('', { status: 500 }));
    await settle();
    render(true);
    expect(pops(button())).toBe(false);
  });
});
