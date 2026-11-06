import type { FastifyInstance } from 'fastify';
import type { SessionNameStore } from '../sessions/session-name-store.js';
import type { SessionRegistry } from '../sessions/session-registry.js';
import { labelOf, type SessionStateTracker } from '../sessions/session-state-tracker.js';
import type { ExternalSessionCheck } from './external-session-check.js';
import type { SessionHistory } from './session-history.js';

export interface PastSessionEntry {
  id: string;
  label: string;
  lastActivity: string;
  runningElsewhere: boolean;
}

export interface PastSessionGroup {
  folder: string;
  sessions: PastSessionEntry[];
}

export interface PastSessionListDependencies {
  history: Pick<SessionHistory, 'list'>;
  externalCheck: Pick<ExternalSessionCheck, 'runningSessionIds'>;
  registry: Pick<SessionRegistry, 'list'>;
  tracker: Pick<SessionStateTracker, 'liveClaudeSessionIds'>;
  names?: Pick<SessionNameStore, 'get'>;
}

export function registerPastSessionListRoute(app: FastifyInstance, deps: PastSessionListDependencies): void {
  app.get('/api/past-sessions', async (): Promise<PastSessionGroup[]> => {
    const hostedPids = deps.registry
      .list()
      .filter((session) => !session.exited)
      .map((session) => session.pid);
    const [sessions, runningElsewhere] = await Promise.all([
      deps.history.list(),
      deps.externalCheck.runningSessionIds(hostedPids),
    ]);
    const hosted = deps.tracker.liveClaudeSessionIds();
    const groups = new Map<string, PastSessionEntry[]>();
    const byRecency = [...sessions].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    for (const session of byRecency) {
      if (session.folder === null || session.firstUserMessage === null || hosted.has(session.id)) continue;
      const entries = groups.get(session.folder) ?? [];
      entries.push({
        id: session.id,
        label: deps.names?.get(session.id) ?? labelOf(session.firstUserMessage),
        lastActivity: session.lastModified.toISOString(),
        runningElsewhere: runningElsewhere.has(session.id),
      });
      groups.set(session.folder, entries);
    }
    return [...groups].map(([folder, entries]) => ({ folder, sessions: entries }));
  });
}
