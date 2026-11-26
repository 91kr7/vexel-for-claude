import { type IncomingHttpHeaders, type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttentionEvent } from './attention-client.js';
import { type NtfyMessage, type NtfyTarget, type PublishResult, publishToNtfy } from './ntfy-publisher.js';
import type { RemoteSend } from './remote-rule.js';
import { sendRemoteNotification } from './remote-notifier.js';
import type { RemoteSettings } from './remote-settings-store.js';

const TOKEN = 'tk_remote_unit_secret';
const TOPIC = 'https://ntfy.example/my-topic';
const RECEIVED_AT = 1_700_000_000_000;

const event: AttentionEvent = {
  id: 'ev-1',
  sessionId: 's1',
  kind: 'needs_input',
  folder: '/home/dev/projects/ai-client',
  label: 'Fix the login form',
  waitingTool: 'Bash',
  waitingDetail: { kind: 'argument', text: 'npm run deploy' },
};
const send: RemoteSend = { event, receivedAt: RECEIVED_AT };
const EXPECTED_MESSAGE = { title: 'ai-client · Fix the login form', message: 'Permission for Bash\nnpm run deploy\nWaiting for 1 min', priority: 4 };

function harness(settings: RemoteSettings | (() => Promise<RemoteSettings>), result: PublishResult | (() => Promise<PublishResult>) = { status: 'sent' }) {
  const published: [NtfyTarget, NtfyMessage][] = [];
  const lines: string[] = [];
  const reads: number[] = [];
  const dependencies = {
    settings: {
      read: () => {
        reads.push(1);
        return typeof settings === 'function' ? settings() : Promise.resolve({ ...settings });
      },
    },
    publish: (target: NtfyTarget, message: NtfyMessage) => {
      published.push([target, message]);
      return typeof result === 'function' ? result() : Promise.resolve(result);
    },
    now: () => RECEIVED_AT + 61_000,
    log: (line: string) => lines.push(line),
  };
  return { dependencies, published, lines, reads };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendRemoteNotification', () => {
  // plan-remote_notifications/REQ-19, REQ-29, REQ-30, REQ-31, REQ-34, REQ-35
  it('reads the settings and publishes the message to the topic, with the token', async () => {
    const { dependencies, published, lines, reads } = harness({ enabled: true, topicUrl: TOPIC, token: TOKEN });
    await sendRemoteNotification(send, dependencies);
    expect(reads).toHaveLength(1);
    expect(published).toEqual([[{ topicUrl: TOPIC, token: TOKEN }, EXPECTED_MESSAGE]]);
    expect(lines).toEqual([]);
  });

  it('publishes with an empty token when none is set', async () => {
    const { dependencies, published } = harness({ enabled: true, topicUrl: TOPIC, token: '' });
    await sendRemoteNotification(send, dependencies);
    expect(published).toEqual([[{ topicUrl: TOPIC, token: '' }, EXPECTED_MESSAGE]]);
  });

  // plan-remote_notifications/REQ-34: the waiting time runs from the event to the send
  it('counts the waiting time from the time the rule got the event', async () => {
    const { dependencies, published } = harness({ enabled: true, topicUrl: TOPIC, token: '' });
    await sendRemoteNotification(send, { ...dependencies, now: () => RECEIVED_AT + 3 * 60_000 + 59_000 });
    expect(published[0]?.[1].message.split('\n').at(-1)).toBe('Waiting for 3 min');
  });

  // plan-remote_notifications/REQ-20
  it('does nothing with the remote switch off', async () => {
    const { dependencies, published, lines } = harness({ enabled: false, topicUrl: TOPIC, token: TOKEN });
    await sendRemoteNotification(send, dependencies);
    expect(published).toEqual([]);
    expect(lines).toEqual([]);
  });

  it('does nothing with an empty topic URL', async () => {
    const { dependencies, published, lines } = harness({ enabled: true, topicUrl: '', token: TOKEN });
    await sendRemoteNotification(send, dependencies);
    expect(published).toEqual([]);
    expect(lines).toEqual([]);
  });

  // plan-remote_notifications/REQ-38, REQ-39
  it('writes one line with the reason of a failed send, without the token, and sends once', async () => {
    const { dependencies, published, lines } = harness(
      { enabled: true, topicUrl: TOPIC, token: TOKEN },
      { status: 'failed', reason: 'The server refused the access token.' },
    );
    await sendRemoteNotification(send, dependencies);
    expect(lines).toEqual(['Remote notification not sent: The server refused the access token.']);
    expect(published).toHaveLength(1);
  });

  // plan-remote_notifications/REQ-38, REQ-39
  it('never rejects when the publish rejects: one line with no error text and no token', async () => {
    const { dependencies, published, lines } = harness({ enabled: true, topicUrl: TOPIC, token: TOKEN }, () =>
      Promise.reject(new Error(`fetch failed: Authorization: Bearer ${TOKEN}`)),
    );
    await expect(sendRemoteNotification(send, dependencies)).resolves.toBeUndefined();
    expect(lines).toEqual(['Remote notification not sent: unexpected error.']);
    expect(published).toHaveLength(1);
  });

  // plan-remote_notifications/REQ-38
  it('never rejects when the settings read rejects: one line, nothing published', async () => {
    const { dependencies, published, lines } = harness(() => Promise.reject(new Error(`bad file with ${TOKEN}`)));
    await expect(sendRemoteNotification(send, dependencies)).resolves.toBeUndefined();
    expect(lines).toEqual(['Remote notification not sent: unexpected error.']);
    expect(published).toEqual([]);
  });

  it('never rejects when the publish throws at once', async () => {
    const { dependencies, lines } = harness({ enabled: true, topicUrl: TOPIC, token: TOKEN });
    const throwing = {
      ...dependencies,
      publish: () => {
        throw new Error(TOKEN);
      },
    };
    await expect(sendRemoteNotification(send, throwing)).resolves.toBeUndefined();
    expect(lines).toEqual(['Remote notification not sent: unexpected error.']);
  });

  // RemoteNotifier: default log is the standard error of the main process
  it('writes to standard error when no log is given', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { dependencies } = harness({ enabled: true, topicUrl: TOPIC, token: TOKEN }, { status: 'failed', reason: 'The server is not reachable.' });
    const { log: _log, ...withoutLog } = dependencies;
    await sendRemoteNotification(send, withoutLog);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0]?.join(' ')).toBe('Remote notification not sent: The server is not reachable.');
  });

  it('uses the system clock when no clock is given', async () => {
    const { dependencies, published } = harness({ enabled: true, topicUrl: TOPIC, token: '' });
    const { now: _now, ...withoutClock } = dependencies;
    await sendRemoteNotification({ event, receivedAt: Date.now() - 2 * 60_000 - 5_000 }, withoutClock);
    expect(published[0]?.[1].message.split('\n').at(-1)).toBe('Waiting for 2 min');
  });
});

describe('sendRemoteNotification with the ntfy publisher and a local fake ntfy server', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function fakeNtfy(status: number) {
    const received: { headers: IncomingHttpHeaders; body: unknown }[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        received.push({ headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown });
        response.writeHead(status, { 'Content-Type': 'application/json' }).end('{}');
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return { topicUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/my-topic`, received };
  }

  // plan-remote_notifications/REQ-19, REQ-29, REQ-35
  it('posts the message with the high priority and the token', async () => {
    const ntfy = await fakeNtfy(200);
    const lines: string[] = [];
    const settings = { read: () => Promise.resolve({ enabled: true, topicUrl: ntfy.topicUrl, token: TOKEN }) };
    await sendRemoteNotification(send, { settings, publish: publishToNtfy, now: () => RECEIVED_AT + 60_500, log: (line) => lines.push(line) });
    expect(ntfy.received).toHaveLength(1);
    expect(ntfy.received[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(ntfy.received[0]?.body).toEqual({ topic: 'my-topic', ...EXPECTED_MESSAGE });
    expect(lines).toEqual([]);
  });

  // plan-remote_notifications/REQ-38, REQ-39
  it('a refused token gives one log line without the token, and no second request', async () => {
    const ntfy = await fakeNtfy(403);
    const lines: string[] = [];
    const settings = { read: () => Promise.resolve({ enabled: true, topicUrl: ntfy.topicUrl, token: TOKEN }) };
    await sendRemoteNotification(send, { settings, publish: publishToNtfy, log: (line) => lines.push(line) });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(ntfy.received).toHaveLength(1);
    expect(lines).toEqual(['Remote notification not sent: The server refused the access token.']);
    expect(lines.join('\n')).not.toContain(TOKEN);
    expect(lines.join('\n')).not.toMatch(/authorization|bearer/i);
  });
});
