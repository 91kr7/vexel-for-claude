// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectFavoriteButton } from './ProjectFavoriteButton';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const ERROR = 'Could not change the favorite mark.';

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(folder: string, favorite: boolean) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const render = (value: boolean) => flushSync(() => root.render(<ProjectFavoriteButton folder={folder} favorite={value} />));
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

describe('ProjectFavoriteButton', () => {
  // plan-project_list_actions/REQ-23, REQ-32
  it('is named "Mark as Favorite", with the same tooltip and an outline star, when the project is not marked', () => {
    const { button } = mount('/work/a', false);
    expect(button().getAttribute('aria-label') ?? button().textContent?.trim()).toBe('Mark as Favorite');
    expect(button().getAttribute('title')).toBe('Mark as Favorite');
    expect(button().querySelector('svg')).not.toBeNull();
    expect(button().querySelector('svg.icon-filled')).toBeNull();
  });

  it('is named "Remove Favorite", with the same tooltip and a filled star, when the project is marked', () => {
    const { button } = mount('/work/a', true);
    expect(button().getAttribute('aria-label') ?? button().textContent?.trim()).toBe('Remove Favorite');
    expect(button().getAttribute('title')).toBe('Remove Favorite');
    expect(button().querySelector('svg.icon-filled')).not.toBeNull();
  });

  it.each([
    [false, true],
    [true, false],
  ])('with favorite %s, a press sends PUT /api/projects/favorite with favorite %s', async (favorite, sent) => {
    const { fetch, answers } = controlledFetch();
    const { button } = mount('/work/web-dashboard', favorite);
    button().click();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/projects\/favorite$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ folder: '/work/web-dashboard', favorite: sent });
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
  });

  it('204 shows no error and does not change the mark by itself', async () => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a', false);
    button().click();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(alertText(host)).toBeNull();
    expect(button().getAttribute('title')).toBe('Mark as Favorite');
    expect(button().querySelector('svg.icon-filled')).toBeNull();
  });

  it('follows the favorite prop', () => {
    const { button, render } = mount('/work/a', false);
    render(true);
    expect(button().getAttribute('title')).toBe('Remove Favorite');
    expect(button().querySelector('svg.icon-filled')).not.toBeNull();
  });

  it('while the request runs it is aria-disabled and aria-busy, and a press sends nothing more', async () => {
    const { fetch, answers } = controlledFetch();
    const { button } = mount('/work/a', false);
    button().click();
    await settle();
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().getAttribute('aria-busy')).toBe('true');
    button().click();
    expect(fetch).toHaveBeenCalledTimes(1);
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(button().getAttribute('aria-disabled')).not.toBe('true');
    expect(button().getAttribute('aria-busy')).not.toBe('true');
    button().click();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 500 answer', (answer: { resolve: (r: Response) => void }) => answer.resolve(new Response('', { status: 500 }))],
    ['a 400 answer', (answer: { resolve: (r: Response) => void }) => answer.resolve(new Response('{"error":"invalid_path"}', { status: 400 }))],
    ['a 200 answer', (answer: { resolve: (r: Response) => void }) => answer.resolve(new Response('', { status: 200 }))],
    ['a network error', (answer: { reject: (e: unknown) => void }) => answer.reject(new TypeError('Failed to fetch'))],
  ])('shows "Could not change the favorite mark." after %s', async (_name, fail) => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a', false);
    button().click();
    fail(answers[0]! as never);
    await settle();
    expect(alertText(host)).toBe(ERROR);
    expect(button().querySelector('svg.icon-filled')).toBeNull();
  });

  it('a new press clears the error', async () => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a', false);
    button().click();
    answers[0]!.reject(new TypeError('Failed to fetch'));
    await settle();
    expect(alertText(host)).toBe(ERROR);
    button().click();
    await settle();
    expect(alertText(host)).toBeNull();
    answers[1]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(alertText(host)).toBeNull();
  });
});
