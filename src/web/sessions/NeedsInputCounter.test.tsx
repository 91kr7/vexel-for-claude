import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState } from './live-session-store';
import { NeedsInputCounter } from './NeedsInputCounter';

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
});
