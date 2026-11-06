import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { StopSessionButton } from './StopSessionButton';

/** Accessible text of each button: its text without aria-hidden parts. */
const buttonLabels = (html: string) =>
  [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1]
      ?.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '')
      .replace(/<[^>]*>/g, '')
      .trim(),
  );

describe('StopSessionButton', () => {
  // plan-claude_sessions_client/REQ-23: no button once the session has ended
  it('renders nothing when the session has ended', () => {
    expect(renderToStaticMarkup(<StopSessionButton sessionId="s1" state="ended" />)).toBe('');
  });

  // plan-claude_sessions_client/REQ-23: the button shows in every other state, unknown state included
  it.each<SessionState | undefined>(['working', 'needs_input', 'idle', undefined])('shows only the button "Terminate" when the state is %s', (state) => {
    const html = renderToStaticMarkup(<StopSessionButton sessionId="s1" state={state} />);
    expect(buttonLabels(html)).toEqual(['Terminate']);
    expect(html).not.toContain('Terminate the Session?');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32: "Terminate" is the rose .button-danger with the decorative "■" first
  it('renders "Terminate" as a .button-danger button with a decorative "■" before its text', () => {
    const html = renderToStaticMarkup(<StopSessionButton sessionId="s1" state="idle" />);
    const button = html.match(/<button\b([^>]*)>([\s\S]*?)<\/button>/);
    expect(button, html).not.toBeNull();
    const classes = button?.[1]?.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain('button-danger');
    expect(button?.[2] ?? '').toMatch(/^<\w+\b[^>]*aria-hidden="true"[^>]*>■<\/\w+>\s*Terminate\s*$/);
  });
});
