import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { RunningToolMonitor } from './running-tool-monitor.js';
import type { SessionStateTracker } from './session-state-tracker.js';
import type { UsageMonitor } from './usage-monitor.js';

export function registerSessionListRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'list'>,
  runningTools?: Pick<RunningToolMonitor, 'get'>,
  usageMonitor?: Pick<UsageMonitor, 'get'>,
): void {
  app.get('/api/sessions', async () =>
    [...tracker.list(), ...(external?.list() ?? [])].map((session) => {
      const runningTool = runningTools?.get(session.id);
      const usage = usageMonitor?.get(session.id);
      return { ...session, ...(runningTool && { runningTool }), ...(usage && { usage }) };
    }),
  );
}
