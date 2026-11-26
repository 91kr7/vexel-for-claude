export interface NtfyTarget {
  topicUrl: string;
  token: string;
}

export interface NtfyMessage {
  title: string;
  message: string;
  priority?: number;
}

export type PublishResult = { status: 'sent' } | { status: 'failed'; reason: string };

export const PUBLISH_TIMEOUT_MS = 10_000;
const DEFAULT_PRIORITY = 3;

export const PUBLISH_REASONS = {
  invalidTopicUrl: 'The topic URL is not valid.',
  tokenRefused: 'The server refused the access token.',
  tokenNeeded: 'The server needs an access token.',
  tooManyMessages: 'The server limits the number of messages. Try again later.',
  timeout: 'The server did not answer within 10 seconds.',
  unreachable: 'Could not reach the server.',
} as const;

function publishPoint(topicUrl: string): { root: string; topic: string } | undefined {
  if (!URL.canParse(topicUrl)) return undefined;
  const url = new URL(topicUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  const cut = url.pathname.lastIndexOf('/') + 1;
  const topic = url.pathname.slice(cut);
  return topic === '' ? undefined : { root: `${url.origin}${url.pathname.slice(0, cut)}`, topic };
}

function statusReason(status: number, withToken: boolean): string {
  if (status === 401 || status === 403) return withToken ? PUBLISH_REASONS.tokenRefused : PUBLISH_REASONS.tokenNeeded;
  if (status === 429) return PUBLISH_REASONS.tooManyMessages;
  return `The server answered with status ${status}.`;
}

export async function publishToNtfy(
  target: NtfyTarget,
  { title, message, priority = DEFAULT_PRIORITY }: NtfyMessage,
  timeoutMs = PUBLISH_TIMEOUT_MS,
): Promise<PublishResult> {
  const point = publishPoint(target.topicUrl);
  if (!point) return { status: 'failed', reason: PUBLISH_REASONS.invalidTopicUrl };
  const withToken = target.token !== '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withToken) headers.Authorization = `Bearer ${target.token}`;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(point.root, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic: point.topic, title, message, priority }),
      signal,
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok ? { status: 'sent' } : { status: 'failed', reason: statusReason(response.status, withToken) };
  } catch {
    // Error texts are never passed on: they could hold the request.
    return { status: 'failed', reason: signal.aborted ? PUBLISH_REASONS.timeout : PUBLISH_REASONS.unreachable };
  }
}
