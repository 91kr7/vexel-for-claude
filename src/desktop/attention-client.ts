export interface AttentionSession {
  sessionId: string;
  folder: string;
  label: string;
  waitingSince?: string;
}

export interface WaitingQuestion {
  question: string;
  options: string[];
}

export type WaitingDetail = { kind: 'argument'; text: string } | { kind: 'questions'; questions: WaitingQuestion[] };

export interface AttentionEvent {
  id: string;
  sessionId: string;
  kind: 'needs_input' | 'turn_end' | 'session_end';
  folder: string;
  label: string;
  waitingTool?: string;
  waitingDetail?: WaitingDetail;
  excerpt?: string;
  error?: boolean;
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
    typeof value.label === 'string' &&
    (value.waitingSince === undefined || typeof value.waitingSince === 'string')
  );
}

function isWaitingQuestion(value: unknown): value is WaitingQuestion {
  return (
    isRecord(value) &&
    typeof value.question === 'string' &&
    Array.isArray(value.options) &&
    value.options.every((option) => typeof option === 'string')
  );
}

function isWaitingDetail(value: unknown): value is WaitingDetail {
  if (!isRecord(value)) return false;
  if (value.kind === 'argument') return typeof value.text === 'string';
  return (
    value.kind === 'questions' &&
    Array.isArray(value.questions) &&
    value.questions.length > 0 &&
    value.questions.every(isWaitingQuestion)
  );
}

function withValidDetail(event: AttentionEvent): AttentionEvent {
  if (event.waitingDetail === undefined || (event.kind === 'needs_input' && isWaitingDetail(event.waitingDetail))) return event;
  const { waitingDetail: _dropped, ...rest } = event;
  return rest;
}

function isAttentionEvent(value: unknown): value is AttentionEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    (value.kind === 'needs_input' || value.kind === 'turn_end' || value.kind === 'session_end') &&
    typeof value.folder === 'string' &&
    typeof value.label === 'string' &&
    (value.waitingTool === undefined || typeof value.waitingTool === 'string') &&
    (value.excerpt === undefined || typeof value.excerpt === 'string') &&
    (value.error === undefined ? value.kind !== 'session_end' : typeof value.error === 'boolean')
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
    handlers.onEvent(withValidDetail(frame.event));
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
    let retryScheduled = false;
    // Node's WebSocket fires only 'error', with no 'close', when the connection is refused.
    const retry = () => {
      if (stopped || retryScheduled) return;
      retryScheduled = true;
      current.close();
      retryTimer = setTimeout(connect, retryMs);
    };
    current.addEventListener('error', retry);
    current.addEventListener('close', retry);
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
