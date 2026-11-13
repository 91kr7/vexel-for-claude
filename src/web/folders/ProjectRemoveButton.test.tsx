// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectRemoveButton } from './ProjectRemoveButton';

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const ERROR = 'Could not remove the project.';

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount(folder: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ProjectRemoveButton folder={folder} />));
  const button = () => host.querySelector('button')!;
  return { host, button };
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

describe('ProjectRemoveButton', () => {
  // plan-project_list_actions/REQ-12, REQ-22
  it('is named "Remove from Projects", with the same tooltip and an icon', () => {
    const { button } = mount('/work/a');
    expect(button().getAttribute('aria-label') ?? button().textContent?.trim()).toBe('Remove from Projects');
    expect(button().getAttribute('title')).toBe('Remove from Projects');
    expect(button().querySelector('svg')).not.toBeNull();
  });

  // plan-project_list_actions/REQ-13: at once, with no confirmation
  it('a press sends POST /api/projects/remove with { folder } at once, with no confirmation', async () => {
    const { fetch, answers } = controlledFetch();
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    const { host, button } = mount('/work/web-dashboard');
    button().click();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/projects\/remove$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ folder: '/work/web-dashboard' });
    expect(confirm).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
  });

  it('204 shows no error', async () => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a');
    button().click();
    answers[0]!.resolve(new Response(null, { status: 204 }));
    await settle();
    expect(alertText(host)).toBeNull();
  });

  it('while the request runs it is aria-disabled and aria-busy, and a press sends nothing more', async () => {
    const { fetch, answers } = controlledFetch();
    const { button } = mount('/work/a');
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
  ])('shows "Could not remove the project." after %s', async (_name, fail) => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a');
    button().click();
    fail(answers[0]! as never);
    await settle();
    expect(alertText(host)).toBe(ERROR);
    expect(button().getAttribute('aria-busy')).not.toBe('true');
  });

  it('a new press clears the error', async () => {
    const { answers } = controlledFetch();
    const { host, button } = mount('/work/a');
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
