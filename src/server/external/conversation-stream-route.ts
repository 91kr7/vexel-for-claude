import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from './external-session-scanner.js';
import type { TranscriptReader } from './transcript-reader.js';

export interface ConversationStreamDependencies {
  scanner: Pick<ExternalSessionScanner, 'get'>;
  reader: Pick<TranscriptReader, 'locate' | 'readFrom'>;
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 1000;
const UNKNOWN_SESSION_CLOSE_CODE = 4404;

export function registerConversationStreamRoute(app: FastifyInstance, deps: ConversationStreamDependencies): void {
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  app.get<{ Params: { id: string } }>('/api/external-sessions/:id/conversation', { websocket: true }, (socket, request) => {
    const sessionId = request.params.id;
    const session = deps.scanner.get(sessionId);
    if (!session) {
      socket.close(UNKNOWN_SESSION_CLOSE_CODE, 'session_not_found');
      return;
    }
    let closed = false;
    let timer: NodeJS.Timeout | undefined;
    let file: string | undefined;
    let offset = 0;
    socket.on('close', () => {
      closed = true;
      clearTimeout(timer);
    });

    const check = async (first: boolean): Promise<void> => {
      file ??= await deps.reader.locate(session.folder, sessionId);
      const read = file ? await deps.reader.readFrom(file, offset) : { items: [], offset };
      if (closed) return;
      offset = read.offset;
      if (first || read.items.length > 0) socket.send(JSON.stringify({ type: 'items', items: read.items }));
      timer = setTimeout(() => void check(false), pollIntervalMs);
    };
    void check(true);
  });
}
