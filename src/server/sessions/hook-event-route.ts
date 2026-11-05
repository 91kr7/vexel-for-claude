import type { FastifyInstance } from 'fastify';
import type { HookEvent, SessionStateTracker } from './session-state-tracker.js';

const BODY_LIMIT_BYTES = 64 * 1024 * 1024;

function isHookEvent(body: unknown): body is HookEvent {
  return typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).hook_event_name === 'string';
}

export function registerHookEventRoute(app: FastifyInstance, tracker: SessionStateTracker): void {
  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/sessions/:id/hook-events',
    { bodyLimit: BODY_LIMIT_BYTES },
    async (request, reply) => {
      if (!isHookEvent(request.body)) {
        return reply.code(400).send({ error: 'invalid_event' });
      }
      if (!tracker.applyHookEvent(request.params.id, request.body)) {
        return reply.code(404).send({ error: 'session_not_found' });
      }
      return reply.code(204).send();
    },
  );
}
