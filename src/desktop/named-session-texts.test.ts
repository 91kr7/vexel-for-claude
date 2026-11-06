// plan-session_list_improvements, batch rename: the label the server gives (the name, when set) reaches the notification title and the tray entry.
import { describe, expect, it } from 'vitest';
import type { AttentionEvent, AttentionSession } from './attention-client.js';
import { notificationTexts } from './notification-texts.js';
import { trayMenuTemplate } from './tray-icon.js';

const noActions = { openWindow: () => undefined, quit: () => undefined };

describe('named session in notifications and tray', () => {
  // plan-session_list_improvements/REQ-27
  it('titles the needs-input notification "<folder> · <name>"', () => {
    const event: AttentionEvent = { id: 'e1', sessionId: 'h1', kind: 'needs_input', folder: '/projects/ai-client', label: 'Release fix', waitingTool: 'Bash' };
    expect(notificationTexts(event).title).toBe('ai-client · Release fix');
  });

  // plan-session_list_improvements/REQ-28
  it('shows "<folder> · <name>" as the tray entry of the waiting session', () => {
    const sessions: AttentionSession[] = [{ sessionId: 'h1', folder: '/projects/ai-client', label: 'Release fix', waitingSince: '2026-11-06T10:00:00.000Z' }];
    expect(trayMenuTemplate(noActions, sessions).map((item) => item.label)).toContain('ai-client · Release fix');
  });
});
