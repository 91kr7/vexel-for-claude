import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionEventsRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'onChange'>,
): void {
  app.get('/api/sessions/events', { websocket: true }, (socket) => {
    const unsubscribe = tracker.onChange((session) => socket.send(JSON.stringify({ type: 'session', session })));
    const unsubscribeRemove = tracker.onRemove((id) => socket.send(JSON.stringify({ type: 'session-removed', id })));
    const unsubscribeExternal = external?.onChange((change) => socket.send(JSON.stringify(change)));
    socket.on('close', () => {
      unsubscribe();
      unsubscribeRemove();
      unsubscribeExternal?.();
    });
  });
}
