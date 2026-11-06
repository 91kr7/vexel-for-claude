import type { FastifyInstance } from 'fastify';
import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import type { RunningToolMonitor } from './running-tool-monitor.js';
import type { SessionStateTracker } from './session-state-tracker.js';

export function registerSessionListRoute(
  app: FastifyInstance,
  tracker: SessionStateTracker,
  external?: Pick<ExternalSessionScanner, 'list'>,
  runningTools?: Pick<RunningToolMonitor, 'get'>,
): void {
  app.get('/api/sessions', async () =>
    [...tracker.list(), ...(external?.list() ?? [])].map((session) => {
      const runningTool = runningTools?.get(session.id);
      return runningTool ? { ...session, runningTool } : session;
    }),
  );
}
