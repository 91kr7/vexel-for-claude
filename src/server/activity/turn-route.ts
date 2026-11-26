import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { SessionStateTracker } from '../sessions/session-state-tracker.js';
import type { ActivityMonitor } from './activity-monitor.js';
import { noTurn, type TurnChange } from './turn-tree.js';

export interface TurnRouteDependencies {
  monitor: Pick<ActivityMonitor, 'turnOf' | 'onTurnChange'>;
  tracker: Pick<SessionStateTracker, 'get'>;
  scanner: Pick<ExternalSessionScanner, 'get'>;
}

const UNKNOWN_SESSION_CLOSE_CODE = 4404;

export function registerTurnRoute(app: FastifyInstance, { monitor, tracker, scanner }: TurnRouteDependencies): void {
  app.get<{ Params: { id: string } }>('/api/sessions/:id/turn', { websocket: true }, (socket, request) => {
    const sessionId = request.params.id;
    if (!tracker.get(sessionId) && !scanner.get(sessionId)) {
      socket.close(UNKNOWN_SESSION_CLOSE_CODE, 'session_not_found');
      return;
    }
    const send = (frame: TurnChange) => socket.send(JSON.stringify(frame));
    const unsubscribe = monitor.onTurnChange((id, change) => {
      if (id === sessionId) send(change);
    });
    socket.on('close', unsubscribe);
    send({ type: 'turn', turn: monitor.turnOf(sessionId) ?? noTurn() });
  });
}
