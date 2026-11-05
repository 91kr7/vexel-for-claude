import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PowerIcon } from '../icons/Icons';
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

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29: "Termina" is the board button (.btn, .label-l) with the power icon before its text
  it('renders "Termina" as a .btn.label-l button with the power icon first', () => {
    const html = renderToStaticMarkup(<StopSessionButton sessionId="s1" state="idle" />);
    const button = html.match(/<button\b([^>]*)>([\s\S]*?)<\/button>/);
    expect(button, html).not.toBeNull();
    const classes = button?.[1]?.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    expect(classes).toEqual(expect.arrayContaining(['btn', 'label-l']));
    const inner = button?.[2] ?? '';
    const icon = renderToStaticMarkup(<PowerIcon />);
    expect(inner.startsWith(icon), 'the icon comes first').toBe(true);
    expect(inner.slice(icon.length).trim()).toBe('Termina');
  });
});
