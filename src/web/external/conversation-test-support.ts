// Test support of the conversation sockets: a fake WebSocket that the test drives, and a fake of the full-content route.
import { vi } from 'vitest';
import { run } from '../settings/settings-test-support';

export class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closedByPage = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
  close(): void {
    this.closedByPage = true;
    this.readyState = 3;
  }
  receive(message: unknown): void {
    const event = new MessageEvent('message', { data: JSON.stringify(message) });
    run(() => {
      this.dispatchEvent(event);
      this.onmessage?.(event);
    });
  }
  serverClose(code = 1006): void {
    this.readyState = 3;
    const event = Object.assign(new Event('close'), { code, wasClean: false });
    run(() => {
      this.dispatchEvent(event);
      this.onclose?.(event);
    });
  }
}

export const socketsOn = (pathEnd: string) => FakeWebSocket.instances.filter((socket) => new URL(socket.url).pathname.endsWith(pathEnd));

/** Stubs `fetch`: every request gets `{ text }` from `answer`, by its path and query. */
export function stubContentRoute(answer: (pathAndQuery: string) => string) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    return new Response(JSON.stringify({ text: answer(`${url.pathname}${url.search}`) }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    requested: () => fetchMock.mock.calls.map(([input]) => {
      const url = new URL(String(input), 'http://localhost');
      return `${url.pathname}${url.search}`;
    }),
  };
}

/** Waits for the promises of the page (a fetch and its JSON), then commits React. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  run(() => {});
}
