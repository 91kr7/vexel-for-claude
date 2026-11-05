import type { FastifyInstance } from 'fastify';
import type { SessionRegistry } from './session-registry.js';
import type { SessionStateTracker } from './session-state-tracker.js';

const MAX_TERMINAL_SIZE = 1000;

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

function parseClientMessage(raw: string): ClientMessage | undefined {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof message !== 'object' || message === null) return undefined;
  const candidate = message as Record<string, unknown>;
  if (candidate.type === 'input' && typeof candidate.data === 'string') {
    return { type: 'input', data: candidate.data };
  }
  if (candidate.type === 'resize' && isTerminalSize(candidate.cols) && isTerminalSize(candidate.rows)) {
    return { type: 'resize', cols: candidate.cols, rows: candidate.rows };
  }
  return undefined;
}

function isTerminalSize(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_TERMINAL_SIZE;
}

export function registerAttachSessionRoute(
  app: FastifyInstance,
  registry: SessionRegistry,
  tracker?: SessionStateTracker,
): void {
  app.get<{ Params: { id: string } }>('/api/sessions/:id/attach', { websocket: true }, (socket, request) => {
    const session = registry.get(request.params.id);
    if (!session) {
      socket.close(4404, 'session not found');
      return;
    }
    const detach = session.attach({
      send: (data) => socket.send(data),
      end: () => socket.close(1000, 'session ended'),
    });
    socket.on('message', (raw, isBinary) => {
      if (isBinary) return;
      const message = parseClientMessage(raw.toString());
      if (message?.type === 'input') {
        session.write(message.data);
        tracker?.applyUserInput(session.id, message.data);
      }
      if (message?.type === 'resize') session.resize(message.cols, message.rows);
    });
    socket.on('close', detach);
  });
}
