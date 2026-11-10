import { isAbsolute, posix, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { lookupChanges } from './changes-lookup.js';
import { lookupFileDiff } from './diff-lookup.js';
import { GitError, type GitRunner } from './git-runner.js';

const isInsideRepository = (file: string) => {
  const normalized = posix.normalize(file);
  return file !== '' && !posix.isAbsolute(file) && normalized !== '..' && !normalized.startsWith('../') && !file.includes('\0');
};

async function answer<T>(reply: FastifyReply, read: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof GitError) return reply.code(500).send({ error: 'git_error', message: error.message });
    throw error;
  }
}

export function registerChangesRoutes(app: FastifyInstance, runner: Pick<GitRunner, 'run' | 'runCapped'>): void {
  app.get<{ Querystring: { path?: string } }>('/api/git/changes', async (request, reply) => {
    const folder = request.query.path;
    if (folder === undefined || !isAbsolute(folder)) return reply.code(400).send({ error: 'invalid_path' });
    return answer(reply, async () => ({ changes: await lookupChanges(runner, resolve(folder)) }));
  });

  app.get<{ Querystring: { path?: string; group?: string; file?: string; oldPath?: string } }>('/api/git/diff', async (request, reply) => {
    const { path: folder, group, file, oldPath } = request.query;
    if (folder === undefined || !isAbsolute(folder)) return reply.code(400).send({ error: 'invalid_path' });
    if (group !== 'staged' && group !== 'unstaged') return reply.code(400).send({ error: 'invalid_group' });
    if (file === undefined || !isInsideRepository(file) || (oldPath !== undefined && !isInsideRepository(oldPath))) {
      return reply.code(400).send({ error: 'invalid_file' });
    }
    return answer(reply, () => lookupFileDiff(runner, resolve(folder), oldPath === undefined ? { group, file } : { group, file, oldPath }));
  });
}
