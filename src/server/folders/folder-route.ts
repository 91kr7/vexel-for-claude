import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

export function registerFolderRoute(app: FastifyInstance): void {
  app.get<{ Querystring: { path?: string } }>('/api/folders', async (request, reply) => {
    const requested = request.query.path ?? homedir();
    if (!isAbsolute(requested)) {
      return reply.code(400).send({ error: 'invalid_path' });
    }
    const path = resolve(requested);
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const folders = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
      const parent = path === '/' ? null : dirname(path);
      return { path, parent, folders };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return reply.code(404).send({ error: 'folder_not_found' });
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return reply.code(403).send({ error: 'folder_not_readable' });
      }
      throw error;
    }
  });
}
