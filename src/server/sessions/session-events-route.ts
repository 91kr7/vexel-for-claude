import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { RunningToolMonitor } from './running-tool-monitor.js';
import type { SessionStateTracker } from './session-state-tracker.js';
import type { UsageMonitor } from './usage-monitor.js';

export function registerSessionEventsRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'onChange' | 'get'>,
  runningTools?: Pick<RunningToolMonitor, 'get' | 'onChange'>,
  usageMonitor?: Pick<UsageMonitor, 'get' | 'onChange'>,
): void {
  const withLiveFields = <T extends { id: string }>(session: T) => {
    const runningTool = runningTools?.get(session.id);
    const usage = usageMonitor?.get(session.id);
    return { ...session, ...(runningTool && { runningTool }), ...(usage && { usage }) };
  };
  app.get('/api/sessions/events', { websocket: true }, (socket) => {
    const sendSession = (session: { id: string }) => socket.send(JSON.stringify({ type: 'session', session: withLiveFields(session) }));
    const unsubscribe = tracker.onChange(sendSession);
    const unsubscribeRemove = tracker.onRemove((id) => socket.send(JSON.stringify({ type: 'session-removed', id })));
    const unsubscribeExternal = external?.onChange((change) =>
      change.type === 'session' ? sendSession(change.session) : socket.send(JSON.stringify(change)),
    );
    const sendCurrent = (id: string) => {
      const session = tracker.get(id) ?? external?.get(id);
      if (session) sendSession(session);
    };
    const unsubscribeTool = runningTools?.onChange(sendCurrent);
    const unsubscribeUsage = usageMonitor?.onChange(sendCurrent);
    socket.on('close', () => {
      unsubscribe();
      unsubscribeRemove();
      unsubscribeExternal?.();
      unsubscribeTool?.();
      unsubscribeUsage?.();
    });
  });
}
