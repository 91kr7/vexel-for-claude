import type { FastifyInstance } from 'fastify';
import type { ProcessTerminator } from './process-terminator.js';

function parseBody(body: unknown): { pid: number; startedAt: number } | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { pid, startedAt } = body as { pid?: unknown; startedAt?: unknown };
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid < 1) return undefined;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return undefined;
  return { pid, startedAt };
}

export function registerTerminateProcessRoute(app: FastifyInstance, terminator: Pick<ProcessTerminator, 'terminate'>): void {
  app.post('/api/processes/terminate', async (request, reply) => {
    const target = parseBody(request.body);
    if (!target) return reply.code(400).send({ error: 'invalid_body' });
    const { outcome, afterAnswer } = await terminator.terminate(target.pid, target.startedAt);
    if (afterAnswer) {
      let done = false;
      const runOnce = () => {
        if (done) return;
        done = true;
        afterAnswer();
      };
      reply.raw.once('finish', runOnce).once('close', runOnce);
    }
    return reply.code(200).send({ outcome });
  });
}
