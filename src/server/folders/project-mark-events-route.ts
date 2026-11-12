import type { FastifyInstance } from 'fastify';
import type { ProjectMarkStore } from './project-mark-store.js';

export function registerProjectMarkEventsRoute(app: FastifyInstance, marks: Pick<ProjectMarkStore, 'favorites' | 'removals' | 'onChange'>): void {
  app.get('/api/projects/marks', { websocket: true }, (socket) => {
    const sendMarks = () =>
      socket.send(JSON.stringify({ type: 'project-marks', favorites: marks.favorites(), removed: marks.removals() }));
    sendMarks();
    const unsubscribe = marks.onChange(sendMarks);
    socket.on('close', unsubscribe);
  });
}
