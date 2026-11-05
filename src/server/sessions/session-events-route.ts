import type { FastifyInstance } from 'fastify';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionEventsRoute(app: FastifyInstance, tracker: SessionStateTracker): void {
  app.get('/api/sessions/events', { websocket: true }, (socket) => {
    const unsubscribe = tracker.onChange((session) => socket.send(JSON.stringify({ type: 'session', session })));
    socket.on('close', unsubscribe);
  });
}
