import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { StopSessionButton } from './StopSessionButton';

const buttonLabels = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.replace(/<[^>]*>/g, '').trim());

describe('StopSessionButton', () => {
  // plan-claude_sessions_client/REQ-23: no button once the session has ended
  it('renders nothing when the session has ended', () => {
    expect(renderToStaticMarkup(<StopSessionButton sessionId="s1" state="ended" />)).toBe('');
  });

  // plan-claude_sessions_client/REQ-23: the button shows in every other state, unknown state included
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', undefined])('shows only the button "Termina" when the state is %s', (state) => {
    const html = renderToStaticMarkup(<StopSessionButton sessionId="s1" state={state} />);
    expect(buttonLabels(html)).toEqual(['Termina']);
    expect(html).not.toContain('Terminare la sessione?');
  });
});
