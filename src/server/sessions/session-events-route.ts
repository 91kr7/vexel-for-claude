import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { RunningToolMonitor } from './running-tool-monitor.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionEventsRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'onChange' | 'get'>,
  runningTools?: Pick<RunningToolMonitor, 'get' | 'onChange'>,
): void {
  const withRunningTool = <T extends { id: string }>(session: T) => {
    const runningTool = runningTools?.get(session.id);
    return runningTool ? { ...session, runningTool } : session;
  };
  app.get('/api/sessions/events', { websocket: true }, (socket) => {
    const sendSession = (session: { id: string }) => socket.send(JSON.stringify({ type: 'session', session: withRunningTool(session) }));
    const unsubscribe = tracker.onChange(sendSession);
    const unsubscribeRemove = tracker.onRemove((id) => socket.send(JSON.stringify({ type: 'session-removed', id })));
    const unsubscribeExternal = external?.onChange((change) =>
      change.type === 'session' ? sendSession(change.session) : socket.send(JSON.stringify(change)),
    );
    const unsubscribeTool = runningTools?.onChange((id) => {
      const session = tracker.get(id) ?? external?.get(id);
      if (session) sendSession(session);
    });
    socket.on('close', () => {
      unsubscribe();
      unsubscribeRemove();
      unsubscribeExternal?.();
      unsubscribeTool?.();
    });
  });
}
