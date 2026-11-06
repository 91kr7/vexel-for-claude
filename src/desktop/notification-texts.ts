import type { AttentionEvent } from './attention-client.js';

export interface NotificationText {
  title: string;
  body: string;
}

function folderNameOf(folder: string): string {
  return folder.split('/').filter((segment) => segment !== '').pop() ?? folder;
}

export function notificationTitle(folder: string, label: string): string {
  return `${folderNameOf(folder)} · ${label}`;
}

export function needsInputBody(waitingTool?: string): string {
  return waitingTool ? `Permission for ${waitingTool}` : 'Needs your input';
}

export function notificationTexts(event: AttentionEvent): NotificationText {
  return { title: notificationTitle(event.folder, event.label), body: needsInputBody(event.waitingTool) };
}
