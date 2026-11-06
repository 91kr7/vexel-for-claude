export interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
}

export interface AttentionEvent {
  id: string;
  sessionId: string;
  kind: 'needs_input';
  folder: string;
  label: string;
  waitingTool?: string;
}

export interface AttentionHandlers {
  onEvent(event: AttentionEvent): void;
  onNeedsInput(sessions: AttentionSession[]): void;
}

export interface AttentionConnection {
  stop(): void;
}

const DEFAULT_RETRY_MS = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAttentionSession(value: unknown): value is AttentionSession {
  return (
    isRecord(value) &&
    typeof value.sessionId === 'string' &&
    typeof value.folder === 'string' &&
    typeof value.label === 'string'
  );
}

function isAttentionEvent(value: unknown): value is AttentionEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    value.kind === 'needs_input' &&
    typeof value.folder === 'string' &&
    typeof value.label === 'string' &&
    (value.waitingTool === undefined || typeof value.waitingTool === 'string')
  );
}

function dispatch(data: unknown, handlers: AttentionHandlers): void {
  if (typeof data !== 'string') return;
  let frame: unknown;
  try {
    frame = JSON.parse(data);
  } catch {
    return;
  }
  if (!isRecord(frame)) return;
  if (frame.type === 'event' && isAttentionEvent(frame.event)) {
    handlers.onEvent(frame.event);
  } else if (frame.type === 'needs-input' && Array.isArray(frame.sessions) && frame.sessions.every(isAttentionSession)) {
    handlers.onNeedsInput(frame.sessions);
  }
}

export function connectAttention(
  origin: string,
  handlers: AttentionHandlers,
  options: { retryMs?: number } = {},
): AttentionConnection {
  const url = `${origin.replace(/^http/, 'ws')}/api/attention`;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  let stopped = false;
  let socket: WebSocket | undefined;
  let retryTimer: NodeJS.Timeout | undefined;

  const connect = () => {
    const current = new WebSocket(url);
    socket = current;
    current.addEventListener('message', (message) => {
      if (!stopped) dispatch(message.data, handlers);
    });
    current.addEventListener('close', () => {
      if (!stopped) retryTimer = setTimeout(connect, retryMs);
    });
  };
  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
