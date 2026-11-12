// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionNameDialog } from './SessionNameDialog';

const project = { folder: '/home/u/shop-api', lastActivity: '2026-11-10T10:00:00.000Z', available: true };

const roots: Root[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync(() => {});
};

const created = (id: string) => new Response(JSON.stringify({ id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
const failed = (status: number) => new Response(JSON.stringify({ error: 'folder_not_found' }), { status, headers: { 'Content-Type': 'application/json' } });

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits the render at once.
function mount() {
  const onStarted = vi.fn();
  const onCancel = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<SessionNameDialog project={project} onStarted={onStarted} onCancel={onCancel} />));
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
  const field = [...host.querySelectorAll('label')].find((label) => label.textContent?.includes('Session name'))?.querySelector('input') as HTMLInputElement;
  const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
  return { host, dialog, field, button, onStarted, onCancel };
}

function type(field: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  flushSync(() => {
    setValue.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function press(target: HTMLElement, key: string) {
  flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
}

const sentBody = (call = 0) => JSON.parse(String((fetchMock.mock.calls[call]![1] as RequestInit).body)) as unknown;
const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SessionNameDialog', () => {
  // plan-recent_projects/REQ-14, REQ-24: title, project box, field, hint and actions in English
  it('is the dialog "New session" with the project, the "Session name" field, the hint, "Cancel" and "Start Session"', () => {
    const { host, dialog, field, button } = mount();
    expect(text(document.getElementById(dialog.getAttribute('aria-labelledby')!))).toBe('New session');
    expect(text(dialog)).toContain('shop-api');
    expect(text(dialog)).toContain('/home/u/shop-api');
    expect(field).toBeTruthy();
    expect(field.value).toBe('');
    expect(text(host)).toContain('Leave it empty to use the default name. Enter starts, Esc cancels.');
    expect(button('Cancel')).toBeTruthy();
    expect(button('Start Session')).toBeTruthy();
  });

  // plan-recent_projects/REQ-23: the field has the focus at open
  it('puts the focus on the field when it opens', () => {
    const { field } = mount();
    expect(document.activeElement).toBe(field);
  });

  // plan-recent_projects/REQ-16, REQ-18, REQ-20: Enter sends the folder and the trimmed name, then onStarted with the id
  it('Enter in the field sends the folder and the trimmed name, then calls onStarted with the id', async () => {
    fetchMock.mockResolvedValue(created('new-id'));
    const { field, onStarted } = mount();
    type(field, '  Rate limiter tests  ');
    press(field, 'Enter');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/sessions');
    expect(init.method).toBe('POST');
    expect(sentBody()).toEqual({ path: '/home/u/shop-api', name: 'Rate limiter tests' });
    expect(onStarted).toHaveBeenCalledExactlyOnceWith('new-id');
  });

  // plan-recent_projects/REQ-19: spaces only send an empty name
  it('"Start Session" with spaces only sends an empty name', async () => {
    fetchMock.mockResolvedValue(created('new-id'));
    const { field, button, onStarted } = mount();
    type(field, '    ');
    flushSync(() => button('Start Session').click());
    await settle();
    expect(sentBody()).toEqual({ path: '/home/u/shop-api', name: '' });
    expect(onStarted).toHaveBeenCalledExactlyOnceWith('new-id');
  });

  // plan-recent_projects/REQ-18: the field keeps the first 200 characters, counted as code points
  it('keeps the first 200 characters of a longer text, counted as code points', () => {
    const { field } = mount();
    type(field, `${'😀'.repeat(199)}ab${'😀'.repeat(50)}`);
    expect(Array.from(field.value)).toHaveLength(200);
    expect(field.value).toBe(`${'😀'.repeat(199)}a`);
  });

  // plan-recent_projects/REQ-18: the field text is trimmed before it is sent
  it('sends the field text trimmed, at most 200 characters', async () => {
    fetchMock.mockResolvedValue(created('new-id'));
    const { field, button } = mount();
    type(field, `${'😀'.repeat(198)}  ${'😀'.repeat(10)}`);
    flushSync(() => button('Start Session').click());
    await settle();
    expect(sentBody()).toEqual({ path: '/home/u/shop-api', name: '😀'.repeat(198) });
  });

  // SessionNameDialog: busy while the request runs, and a second Enter sends nothing
  it('is busy while the request runs, and a second Enter sends nothing', async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)));
    const { field, button, onStarted } = mount();
    press(field, 'Enter');
    await settle();
    expect(button('Start Session').getAttribute('aria-busy')).toBe('true');
    press(field, 'Enter');
    flushSync(() => button('Start Session').click());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    answer(created('late-id'));
    await settle();
    expect(onStarted).toHaveBeenCalledExactlyOnceWith('late-id');
  });

  // plan-recent_projects/REQ-22: a failed start shows the error and the dialog stays open
  it.each([
    ['an error answer', () => Promise.resolve(failed(404))],
    ['a server error', () => Promise.resolve(failed(500))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('on %s shows "Could not start the session." and stays open, ready for a new start', async (_label, outcome) => {
    fetchMock.mockImplementation(outcome);
    const { host, field, button, onStarted, onCancel } = mount();
    type(field, 'Name');
    press(field, 'Enter');
    await settle();
    expect(text(host)).toContain('Could not start the session.');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(onStarted).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(button('Start Session').disabled).toBe(false);
    expect(button('Start Session').getAttribute('aria-busy')).toBeNull();
  });

  // SessionNameDialog: a new start hides the old message
  it('hides the old error when a new start begins', async () => {
    fetchMock.mockResolvedValueOnce(failed(404));
    const { host, field, button } = mount();
    press(field, 'Enter');
    await settle();
    expect(text(host)).toContain('Could not start the session.');
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    flushSync(() => button('Start Session').click());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(text(host)).not.toContain('Could not start the session.');
  });

  // plan-recent_projects/REQ-21: Esc, "Cancel" and "[Esc]" cancel with no request
  it.each([
    ['Esc', (ui: ReturnType<typeof mount>) => press(ui.field, 'Escape')],
    ['"Cancel"', (ui: ReturnType<typeof mount>) => flushSync(() => ui.button('Cancel').click())],
    ['"[Esc]"', (ui: ReturnType<typeof mount>) => flushSync(() => ui.button('[Esc]').click())],
  ])('%s calls onCancel and sends no request', async (_label, act) => {
    const ui = mount();
    type(ui.field, 'Something');
    act(ui);
    await settle();
    expect(ui.onCancel).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ui.onStarted).not.toHaveBeenCalled();
  });
});
