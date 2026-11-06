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

export function turnEndBody(excerpt?: string): string {
  return excerpt || 'Claude finished';
}

export function sessionEndBody(error?: boolean): string {
  return error === true ? 'Session ended with an error' : 'Session ended';
}

function bodyOf(event: AttentionEvent): string {
  switch (event.kind) {
    case 'needs_input':
      return needsInputBody(event.waitingTool);
    case 'turn_end':
      return turnEndBody(event.excerpt);
    case 'session_end':
      return sessionEndBody(event.error);
  }
}

export function notificationTexts(event: AttentionEvent): NotificationText {
  return { title: notificationTitle(event.folder, event.label), body: bodyOf(event) };
}

export function groupNotificationTexts(sessions: readonly { folder: string; label: string }[]): NotificationText {
  return {
    title: `${sessions.length} sessions need your attention`,
    body: sessions.map((session) => notificationTitle(session.folder, session.label)).join('\n'),
  };
}
