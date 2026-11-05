import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { registerFolderRoute } from './folders/folder-route.js';
import { registerLocalAccessGuard } from './local-access-guard.js';
import { registerAttachSessionRoute } from './sessions/attach-session-route.js';
import { SessionRegistry } from './sessions/session-registry.js';
import { registerStartSessionRoute } from './sessions/start-session-route.js';

const HOST = '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
const webRoot = fileURLToPath(new URL('../../dist/web', import.meta.url));

const app = Fastify({ logger: true });
const registry = new SessionRegistry();

registerLocalAccessGuard(app);
await app.register(fastifyWebsocket);

app.get('/api/health', async () => ({ status: 'ok' }));
registerStartSessionRoute(app, registry);
registerAttachSessionRoute(app, registry);
registerFolderRoute(app);

// In dev the page comes from Vite, so dist/web may not exist yet.
if (existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot });
}

await app.listen({ host: HOST, port });
