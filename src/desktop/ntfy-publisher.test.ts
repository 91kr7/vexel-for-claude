// Tests of plan-remote_notifications, batch test-notification: NtfyPublisher spec (REQ-15, REQ-17, REQ-18). A local HTTP server
// stands in for ntfy: nothing reaches ntfy.sh.
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { type NtfyMessage, PUBLISH_TIMEOUT_MS, publishToNtfy } from './ntfy-publisher.js';

const TOKEN = 'tk_Secret_9f3a';
const MESSAGE: NtfyMessage = { title: 'Vexel for Claude', message: 'Test notification. Remote notifications reach this device.' };

const REFUSED = 'The server refused the access token.';
const NEEDS_TOKEN = 'The server needs an access token.';
const LIMITED = 'The server limits the number of messages. Try again later.';
const NO_ANSWER = 'The server did not answer within 10 seconds.';
const UNREACHABLE = 'Could not reach the server.';
const INVALID_URL = 'The topic URL is not valid.';

interface Received {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

type Responder = (response: ServerResponse) => void;

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

/** A fake ntfy server: it records each request and answers it with `respond`. */
async function fakeNtfy(respond: Responder = (response) => response.writeHead(200).end('{}')) {
  const received: Received[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({ method: request.method ?? '', url: request.url ?? '', headers: request.headers, body: Buffer.concat(chunks).toString('utf8') });
      respond(response);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { origin, received };
}

const status = (code: number, body = ''): Responder => (response) => response.writeHead(code).end(body);

describe('publishToNtfy', () => {
  it('has a time limit of 10 seconds', () => {
    expect(PUBLISH_TIMEOUT_MS).toBe(10_000);
  });

  // plan-remote_notifications/REQ-15: one JSON POST to the server root, with the topic as the last path segment
  it('posts one JSON message to the root of the server, with topic, title, message and the default priority 3', async () => {
    const ntfy = await fakeNtfy();
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: '' }, MESSAGE)).toEqual({ status: 'sent' });
    expect(ntfy.received).toHaveLength(1);
    const [request] = ntfy.received;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('/');
    expect(request?.headers['content-type']).toMatch(/^application\/json\b/);
    expect(JSON.parse(request?.body ?? '')).toEqual({ topic: 'my-topic', title: MESSAGE.title, message: MESSAGE.message, priority: 3 });
  });

  it('posts to the path up to the topic, without query and fragment', async () => {
    const ntfy = await fakeNtfy();
    await publishToNtfy({ topicUrl: `${ntfy.origin}/base/my-topic?x=1#part`, token: '' }, MESSAGE);
    expect(ntfy.received.map((request) => request.url)).toEqual(['/base/']);
    expect(JSON.parse(ntfy.received[0]?.body ?? '').topic).toBe('my-topic');
  });

  it('sends the priority it is given', async () => {
    const ntfy = await fakeNtfy();
    await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: '' }, { ...MESSAGE, priority: 5 });
    expect(JSON.parse(ntfy.received[0]?.body ?? '').priority).toBe(5);
  });

  it('keeps non-ASCII text in the title and the message intact', async () => {
    const ntfy = await fakeNtfy();
    const text = { title: 'Prüfung — 日本語 ✓', message: 'Ça marche: «test» 🚀' };
    await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: '' }, text);
    expect(JSON.parse(ntfy.received[0]?.body ?? '')).toMatchObject(text);
  });

  // plan-remote_notifications/REQ-15: the token goes with the message when one is set
  it('sends the token as a Bearer authorization header', async () => {
    const ntfy = await fakeNtfy();
    await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: TOKEN }, MESSAGE);
    expect(ntfy.received[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('sends no authorization header with an empty token', async () => {
    const ntfy = await fakeNtfy();
    await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: '' }, MESSAGE);
    expect(ntfy.received[0]?.headers).not.toHaveProperty('authorization');
  });

  it.each([200, 201, 204])('gives sent for status %i', async (code) => {
    const ntfy = await fakeNtfy(status(code));
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: TOKEN }, MESSAGE)).toEqual({ status: 'sent' });
  });

  // plan-remote_notifications/REQ-17: each failure gives its short reason
  it.each([
    [401, TOKEN, REFUSED],
    [403, TOKEN, REFUSED],
    [401, '', NEEDS_TOKEN],
    [403, '', NEEDS_TOKEN],
    [429, TOKEN, LIMITED],
    [429, '', LIMITED],
    [400, TOKEN, 'The server answered with status 400.'],
    [404, '', 'The server answered with status 404.'],
    [500, TOKEN, 'The server answered with status 500.'],
    [503, '', 'The server answered with status 503.'],
  ])('gives failed for status %i with token "%s": "%s"', async (code, token, reason) => {
    const ntfy = await fakeNtfy(status(code, '{"error":"nope"}'));
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token }, MESSAGE)).toEqual({ status: 'failed', reason });
  });

  it('gives failed "did not answer" when the server does not answer within the time limit', async () => {
    const ntfy = await fakeNtfy(() => {});
    const started = Date.now();
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: TOKEN }, MESSAGE, 300)).toEqual({ status: 'failed', reason: NO_ANSWER });
    expect(Date.now() - started).toBeLessThan(PUBLISH_TIMEOUT_MS);
  });

  it('waits for an answer that comes within the default time limit', async () => {
    const ntfy = await fakeNtfy((response) => setTimeout(() => response.writeHead(200).end('{}'), 500));
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: '' }, MESSAGE)).toEqual({ status: 'sent' });
  });

  it('gives failed "could not reach" on a network error', async () => {
    const ntfy = await fakeNtfy();
    const server = servers.pop()!;
    await new Promise((resolve) => server.close(resolve));
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: TOKEN }, MESSAGE)).toEqual({ status: 'failed', reason: UNREACHABLE });
  });

  it('gives failed "could not reach" when the server drops the connection', async () => {
    const ntfy = await fakeNtfy((response) => response.socket?.destroy());
    expect(await publishToNtfy({ topicUrl: `${ntfy.origin}/my-topic`, token: TOKEN }, MESSAGE)).toEqual({ status: 'failed', reason: UNREACHABLE });
  });

  it.each([
    ['an empty URL', () => ''],
    ['text that is not a URL', () => 'not a url'],
    ['a URL with another scheme', (origin: string) => origin.replace('http:', 'ftp:') + '/my-topic'],
    ['a URL with no topic segment', (origin: string) => `${origin}/`],
  ])('gives failed "not valid" for %s, and sends no request', async (_name, topicUrl) => {
    const ntfy = await fakeNtfy();
    expect(await publishToNtfy({ topicUrl: topicUrl(ntfy.origin), token: TOKEN }, MESSAGE)).toEqual({ status: 'failed', reason: INVALID_URL });
    expect(ntfy.received).toHaveLength(0);
  });

  // plan-remote_notifications/REQ-18: no reason holds the token, the headers, the body or the server's error text
  it('puts no token, header, body or server text in any reason', async () => {
    const echo: Responder = (response) => response.writeHead(401).end(`Bearer ${TOKEN} rejected for ${MESSAGE.message}`);
    const results = [
      await publishToNtfy({ topicUrl: `${(await fakeNtfy(echo)).origin}/my-topic`, token: TOKEN }, MESSAGE),
      await publishToNtfy({ topicUrl: `${(await fakeNtfy(status(429, TOKEN))).origin}/my-topic`, token: TOKEN }, MESSAGE),
      await publishToNtfy({ topicUrl: `${(await fakeNtfy(status(500, TOKEN))).origin}/my-topic`, token: TOKEN }, MESSAGE),
      await publishToNtfy({ topicUrl: `${(await fakeNtfy(() => {})).origin}/my-topic`, token: TOKEN }, MESSAGE, 200),
      await publishToNtfy({ topicUrl: `${(await fakeNtfy((response) => response.socket?.destroy())).origin}/my-topic`, token: TOKEN }, MESSAGE),
      await publishToNtfy({ topicUrl: `ftp://${TOKEN}`, token: TOKEN }, MESSAGE),
    ];
    for (const result of results) {
      expect(result.status).toBe('failed');
      const reason = result.status === 'failed' ? result.reason : '';
      for (const secret of [TOKEN, 'Bearer', 'Authorization', 'rejected', MESSAGE.message, 'application/json']) expect(reason).not.toContain(secret);
    }
  });

  it('uses no Electron API', async () => {
    const source = await readFile(new URL('./ntfy-publisher.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\)/);
  });
});
