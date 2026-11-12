import type { FastifyInstance } from 'fastify';

export function registerInstalledVersionRoute(app: FastifyInstance, installedVersion: string): void {
  app.get('/api/installed-version', async () => ({ version: installedVersion }));
}
