import { isAbsolute, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { answer, isInsideRepository } from './changes-route.js';
import { lookupCommitFileDiff } from './commit-diff-lookup.js';
import { lookupCommitFiles } from './commit-files-lookup.js';
import type { GitRunner } from './git-runner.js';
import { lookupHistory } from './history-lookup.js';

// Full object names only: SHA-1 or SHA-256.
const isFullHash = (hash: string | undefined): hash is string => hash !== undefined && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(hash);

const offsetOf = (offset: string | undefined): number | undefined => {
  if (offset === undefined) return 0;
  const value = Number(offset);
  return /^\d+$/.test(offset) && Number.isSafeInteger(value) ? value : undefined;
};

export function registerHistoryRoutes(app: FastifyInstance, runner: Pick<GitRunner, 'run' | 'runCapped'>): void {
  app.get<{ Querystring: { path?: string; offset?: string } }>('/api/git/history', async (request, reply) => {
    const { path: folder } = request.query;
    if (folder === undefined || !isAbsolute(folder)) return reply.code(400).send({ error: 'invalid_path' });
    const offset = offsetOf(request.query.offset);
    if (offset === undefined) return reply.code(400).send({ error: 'invalid_offset' });
    return answer(reply, () => lookupHistory(runner, resolve(folder), offset));
  });

  app.get<{ Querystring: { path?: string; hash?: string } }>('/api/git/commit-files', async (request, reply) => {
    const { path: folder, hash } = request.query;
    if (folder === undefined || !isAbsolute(folder)) return reply.code(400).send({ error: 'invalid_path' });
    if (!isFullHash(hash)) return reply.code(400).send({ error: 'invalid_hash' });
    return answer(reply, async () => ({ files: await lookupCommitFiles(runner, resolve(folder), hash) }));
  });

  app.get<{ Querystring: { path?: string; hash?: string; file?: string; oldPath?: string } }>('/api/git/commit-diff', async (request, reply) => {
    const { path: folder, hash, file, oldPath } = request.query;
    if (folder === undefined || !isAbsolute(folder)) return reply.code(400).send({ error: 'invalid_path' });
    if (!isFullHash(hash)) return reply.code(400).send({ error: 'invalid_hash' });
    if (file === undefined || !isInsideRepository(file) || (oldPath !== undefined && !isInsideRepository(oldPath))) {
      return reply.code(400).send({ error: 'invalid_file' });
    }
    return answer(reply, () => lookupCommitFileDiff(runner, resolve(folder), oldPath === undefined ? { hash, file } : { hash, file, oldPath }));
  });
}
