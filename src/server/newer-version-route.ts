import type { FastifyInstance } from 'fastify';
import type { ReleaseCheckResult } from './release-check.js';

export function registerNewerVersionRoute(app: FastifyInstance, result: Promise<ReleaseCheckResult>): void {
  const settled = result.catch((): ReleaseCheckResult => ({ status: 'none' }));
  app.get('/api/newer-version', async () => settled);
}
