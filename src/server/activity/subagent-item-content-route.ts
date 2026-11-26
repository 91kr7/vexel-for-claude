import type { FastifyInstance } from 'fastify';
import type { TranscriptReader } from '../external/transcript-reader.js';
import { locateSubagentFile, type SubagentFileSources } from './subagent-file-locator.js';

export interface SubagentItemContentDependencies extends SubagentFileSources {
  reader: Pick<TranscriptReader, 'locate' | 'readItem'>;
}

const NON_NEGATIVE_INTEGER = /^\d{1,15}$/;

const isIndex = (value: unknown): value is string => typeof value === 'string' && NON_NEGATIVE_INTEGER.test(value);

export function registerSubagentItemContentRoute(app: FastifyInstance, deps: SubagentItemContentDependencies): void {
  app.get<{ Params: { id: string; agentId: string }; Querystring: { offset?: unknown; block?: unknown } }>(
    '/api/sessions/:id/subagents/:agentId/items',
    async (request, reply) => {
      const { offset, block } = request.query;
      if (!isIndex(offset) || !isIndex(block)) return reply.code(400).send({ error: 'invalid_reference' });
      const file = await locateSubagentFile(deps, request.params.id, request.params.agentId);
      if (!file) return reply.code(404).send({ error: 'session_not_found' });
      const text = await deps.reader.readItem(file, { offset: Number(offset), block: Number(block) }, { sidechain: true });
      if (text === undefined) return reply.code(404).send({ error: 'item_not_found' });
      return { text };
    },
  );
}
