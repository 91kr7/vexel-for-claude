import type { MenuItemConstructorOptions } from 'electron';
import type { AttentionSession } from './attention-client.js';
import { notificationTitle } from './notification-texts.js';

export const TRAY_TOOLTIP = 'Vexel for Claude';

export interface TrayActions {
  openWindow: () => void;
  quit: () => void;
  openSession?: (sessionId: string) => void;
}

export function trayTooltip(waitingCount: number): string {
  if (waitingCount === 0) return TRAY_TOOLTIP;
  return waitingCount === 1
    ? `${TRAY_TOOLTIP} · 1 session needs input`
    : `${TRAY_TOOLTIP} · ${waitingCount} sessions need input`;
}

export function trayIconFile(waitingCount: number): string {
  return waitingCount === 0 ? 'vexel-for-claude.png' : 'vexel-for-claude-attention.png';
}

function waitingSinceTime(session: AttentionSession): number {
  const time = session.waitingSince === undefined ? Number.NaN : Date.parse(session.waitingSince);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function longestWaitingFirst(sessions: readonly AttentionSession[]): AttentionSession[] {
  return [...sessions].sort((a, b) => {
    const timeA = waitingSinceTime(a);
    const timeB = waitingSinceTime(b);
    return timeA === timeB ? 0 : timeA < timeB ? -1 : 1;
  });
}

export function trayMenuTemplate(
  actions: TrayActions,
  sessions: readonly AttentionSession[] = [],
): MenuItemConstructorOptions[] {
  const sessionItems: MenuItemConstructorOptions[] = longestWaitingFirst(sessions).map((session) => ({
    label: notificationTitle(session.folder, session.label).replaceAll('&', '&&'),
    click: () => actions.openSession?.(session.sessionId),
  }));
  return [
    ...sessionItems,
    ...(sessionItems.length > 0 ? [{ type: 'separator' } as const] : []),
    { label: 'Open Window', click: () => actions.openWindow() },
    { label: 'Quit', click: () => actions.quit() },
  ];
}
