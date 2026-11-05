import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { NeedsInputCounter } from './NeedsInputCounter';
import { StateIcon } from './StateBadge';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('NeedsInputCounter', () => {
  const renderCounter = (states: SessionState[]) =>
    renderToStaticMarkup(
      <NeedsInputCounter
        sessions={states.map((state, i) => ({ id: `s${i}`, folder: `/p/s${i}`, label: `s${i}`, state, lastActivity: '2026-11-05T10:00:00.000Z' }))}
      />,
    );
  const statusElement = (html: string) => html.match(/<(\w+)([^>]*role="status"[^>]*)>([\s\S]*?)<\/\1>/);

  // plan-claude_sessions_client/REQ-17: counts the sessions in needs input and highlights a non-zero count
  it('shows "Richiede input: N" as a highlighted status when N > 0', () => {
    const match = statusElement(renderCounter(['needs_input', 'working', 'needs_input', 'ended', 'idle']));
    expect(textOf(match?.[3] ?? '')).toBe('Richiede input: 2');
    expect(match?.[2]).toMatch(/class="[^"]*\bactive\b/);
  });

  // plan-claude_sessions_client/REQ-17: zero is shown too, not highlighted
  it('shows "Richiede input: 0" without highlight when no session needs input', () => {
    const match = statusElement(renderCounter(['working', 'idle']));
    expect(textOf(match?.[3] ?? '')).toBe('Richiede input: 0');
    expect(match?.[2] ?? '').not.toMatch(/class="[^"]*\bactive\b/);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-14: with N > 0 the needs-input icon comes before the text
  it('shows the needs-input icon of StateBadge before the text when N > 0', () => {
    const inner = statusElement(renderCounter(['needs_input', 'idle']))?.[3] ?? '';
    const icon = renderToStaticMarkup(<StateIcon state="needs_input" />);
    expect(inner.trim().startsWith(icon), inner).toBe(true);
    expect(textOf(inner.trim().slice(icon.length))).toBe('Richiede input: 1');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-14: with N = 0 there is no icon
  it('shows no icon when N = 0', () => {
    const inner = statusElement(renderCounter(['working', 'ended']))?.[3] ?? '';
    expect(inner).not.toMatch(/<svg\b/);
  });
});
