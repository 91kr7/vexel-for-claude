import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from './external-session-scanner.js';
import type { TranscriptReader } from './transcript-reader.js';

export interface ItemContentDependencies {
  scanner: Pick<ExternalSessionScanner, 'get'>;
  reader: Pick<TranscriptReader, 'locate' | 'readItem'>;
}

const NON_NEGATIVE_INTEGER = /^\d{1,15}$/;

const isIndex = (value: unknown): value is string => typeof value === 'string' && NON_NEGATIVE_INTEGER.test(value);

export function registerItemContentRoute(app: FastifyInstance, deps: ItemContentDependencies): void {
  app.get<{ Params: { id: string }; Querystring: { offset?: unknown; block?: unknown } }>(
    '/api/external-sessions/:id/items',
    async (request, reply) => {
      const { offset, block } = request.query;
      if (!isIndex(offset) || !isIndex(block)) return reply.code(400).send({ error: 'invalid_reference' });
      const sessionId = request.params.id;
      const file = await deps.reader.locate(deps.scanner.get(sessionId)?.folder ?? '', sessionId);
      if (!file) return reply.code(404).send({ error: 'session_not_found' });
      const text = await deps.reader.readItem(file, { offset: Number(offset), block: Number(block) });
      if (text === undefined) return reply.code(404).send({ error: 'item_not_found' });
      return { text };
    },
  );
}
