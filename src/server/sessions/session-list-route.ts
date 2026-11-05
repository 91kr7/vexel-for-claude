import type { FastifyInstance } from 'fastify';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionListRoute(app: FastifyInstance, tracker: SessionStateTracker): void {
  app.get('/api/sessions', async () => tracker.list());
}
