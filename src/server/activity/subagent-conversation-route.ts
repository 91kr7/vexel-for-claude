import type { FastifyInstance } from 'fastify';
import type { TranscriptReader } from '../external/transcript-reader.js';
import { locateSubagentFile, type SubagentFileSources } from './subagent-file-locator.js';

export interface SubagentConversationDependencies extends SubagentFileSources {
  reader: Pick<TranscriptReader, 'locate' | 'readFrom'>;
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 1000;
const NOT_FOUND_CLOSE_CODE = 4404;
const SIDECHAIN = { sidechain: true };

export function registerSubagentConversationRoute(app: FastifyInstance, deps: SubagentConversationDependencies): void {
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  app.get<{ Params: { id: string; agentId: string } }>(
    '/api/sessions/:id/subagents/:agentId/conversation',
    { websocket: true },
    (socket, request) => {
      let closed = false;
      let timer: NodeJS.Timeout | undefined;
      let offset = 0;
      socket.on('close', () => {
        closed = true;
        clearTimeout(timer);
      });

      const check = async (file: string, first: boolean): Promise<void> => {
        const read = await deps.reader.readFrom(file, offset, SIDECHAIN);
        if (closed) return;
        offset = read.offset;
        if (first || read.items.length > 0) socket.send(JSON.stringify({ type: 'items', items: read.items }));
        timer = setTimeout(() => void check(file, false), pollIntervalMs);
      };

      void locateSubagentFile(deps, request.params.id, request.params.agentId).then((file) => {
        if (closed) return;
        if (file) void check(file, true);
        else socket.close(NOT_FOUND_CLOSE_CODE, 'subagent_not_found');
      });
    },
  );
}
