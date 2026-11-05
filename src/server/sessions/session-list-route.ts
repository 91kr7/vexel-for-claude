import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionListRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'list'>,
): void {
  app.get('/api/sessions', async () => [...tracker.list(), ...(external?.list() ?? [])]);
}
