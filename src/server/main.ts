import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { registerConversationStreamRoute } from './external/conversation-stream-route.js';
import { ExternalSessionScanner } from './external/external-session-scanner.js';
import { registerItemContentRoute } from './external/item-content-route.js';
import { TranscriptReader } from './external/transcript-reader.js';
import { registerFolderRoute } from './folders/folder-route.js';
import { ExternalSessionCheck } from './history/external-session-check.js';
import { registerPastSessionListRoute } from './history/past-session-list-route.js';
import { registerResumeSessionRoute } from './history/resume-session-route.js';
import { SessionHistory } from './history/session-history.js';
import { registerLocalAccessGuard } from './local-access-guard.js';
import { registerAttachSessionRoute } from './sessions/attach-session-route.js';
import { AttentionMonitor } from './sessions/attention-monitor.js';
import { registerAttentionRoute } from './sessions/attention-route.js';
import { registerHookEventRoute } from './sessions/hook-event-route.js';
import { writeHookSettings } from './sessions/hook-settings.js';
import { registerSessionEventsRoute } from './sessions/session-events-route.js';
import { registerSessionListRoute } from './sessions/session-list-route.js';
import { SessionRegistry } from './sessions/session-registry.js';
import { SessionStateTracker } from './sessions/session-state-tracker.js';
import { registerStartSessionRoute } from './sessions/start-session-route.js';
import { registerStopSessionRoute } from './sessions/stop-session-route.js';

const HOST = '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
const webRoot = fileURLToPath(new URL('../../dist/web', import.meta.url));

const app = Fastify({ logger: true });
const settingsPath = await writeHookSettings(`http://${HOST}:${port}`);
const registry = new SessionRegistry({ settingsPath });
const tracker = new SessionStateTracker();
registry.onSessionStart((session) => tracker.track(session));
const history = new SessionHistory();
const externalCheck = new ExternalSessionCheck();
const externalScanner = new ExternalSessionScanner({
  check: externalCheck,
  history,
  hostedPids: () => registry.hostedPids(),
});
const transcriptReader = new TranscriptReader();
const attentionMonitor = new AttentionMonitor({ tracker, scanner: externalScanner });

registerLocalAccessGuard(app);
await app.register(fastifyWebsocket);

app.get('/api/health', async () => ({ status: 'ok' }));
registerStartSessionRoute(app, registry);
registerStopSessionRoute(app, registry);
registerAttachSessionRoute(app, registry, tracker);
registerSessionListRoute(app, tracker, externalScanner);
registerSessionEventsRoute(app, tracker, externalScanner);
registerHookEventRoute(app, tracker);
registerFolderRoute(app);
registerPastSessionListRoute(app, { history, externalCheck, registry, tracker });
registerResumeSessionRoute(app, { history, registry });
registerConversationStreamRoute(app, { scanner: externalScanner, reader: transcriptReader });
registerItemContentRoute(app, { scanner: externalScanner, reader: transcriptReader });
registerAttentionRoute(app, attentionMonitor);

// In dev the page comes from Vite, so dist/web may not exist yet.
if (existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot });
}

externalScanner.start();
await app.listen({ host: HOST, port });

async function stopServer(): Promise<void> {
  const running = registry.list().filter((session) => !session.exited);
  await Promise.all(
    running.map(
      (session) =>
        new Promise<void>((resolve) => {
          session.onExit(resolve);
          session.stop();
        }),
    ),
  );
  await app.close();
  process.exit(0);
}

let stopping: Promise<void> | undefined;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopping ??= stopServer();
  });
}
