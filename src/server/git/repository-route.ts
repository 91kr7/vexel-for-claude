import { isAbsolute, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { GitError, type GitRunner } from './git-runner.js';
import { lookupRepository } from './repository-lookup.js';

export function registerRepositoryRoute(app: FastifyInstance, runner: Pick<GitRunner, 'run'>): void {
  app.get<{ Querystring: { path?: string } }>('/api/git/repository', async (request, reply) => {
    const requested = request.query.path;
    if (requested === undefined || !isAbsolute(requested)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    try {
      return await lookupRepository(runner, resolve(requested));
    } catch (error) {
      if (error instanceof GitError) return reply.code(500).send({ error: 'git_error', message: error.message });
      throw error;
    }
  });
}
