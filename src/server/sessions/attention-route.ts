import type { FastifyInstance } from 'fastify';
import type { AttentionMonitor, AttentionSession } from './attention-monitor.js';

export function registerAttentionRoute(
  app: FastifyInstance,
  monitor: Pick<AttentionMonitor, 'needsInput' | 'onEvent' | 'onNeedsInputChange'>,
): void {
  app.get('/api/attention', { websocket: true }, (socket) => {
    const sendList = (sessions: AttentionSession[]) => socket.send(JSON.stringify({ type: 'needs-input', sessions }));
    sendList(monitor.needsInput());
    const unsubscribeList = monitor.onNeedsInputChange(sendList);
    const unsubscribeEvents = monitor.onEvent((event) => socket.send(JSON.stringify({ type: 'event', event })));
    socket.on('close', () => {
      unsubscribeList();
      unsubscribeEvents();
    });
  });
}
