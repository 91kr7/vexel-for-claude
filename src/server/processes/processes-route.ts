import type { FastifyInstance } from 'fastify';
import type { ProcessList } from './process-list.js';

export function registerProcessesRoute(app: FastifyInstance, processList: Pick<ProcessList, 'list'>): void {
  app.get('/api/processes', async () => ({ processes: await processList.list() }));
}
