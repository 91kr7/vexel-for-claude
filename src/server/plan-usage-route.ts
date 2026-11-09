import type { FastifyInstance } from 'fastify';
import type { PlanLimitsReader, PlanLimitsResult } from './plan-limits-reader.js';

export function registerPlanUsageRoute(app: FastifyInstance, reader: Pick<PlanLimitsReader, 'read'>): void {
  let inFlight: Promise<PlanLimitsResult> | undefined;
  const readShared = (): Promise<PlanLimitsResult> => {
    inFlight ??= (async () => reader.read())()
      .catch((): PlanLimitsResult => ({ status: 'error' }))
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
  app.get('/api/plan-usage', async () => readShared());
}
