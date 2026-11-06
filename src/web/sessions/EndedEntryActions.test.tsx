import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EndedEntryActions } from './EndedEntryActions';

const buttonsIn = (html: string) => [...html.matchAll(/<button([^>]*)>/g)].map((m) => m[1] ?? '');
const attribute = (attributes: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];

describe('EndedEntryActions', () => {
  // plan-session_list_improvements/REQ-2: "Resume" then "Dismiss", each with its accessible name and tooltip
  it('shows "Resume" then "Dismiss" when resumable, each named and titled', () => {
    const buttons = buttonsIn(renderToStaticMarkup(<EndedEntryActions sessionId="s1" resumable />));
    expect(buttons.map((b) => attribute(b, 'aria-label'))).toEqual(['Resume', 'Dismiss']);
    expect(buttons.map((b) => attribute(b, 'title'))).toEqual(['Resume', 'Dismiss']);
    expect(buttons.map((b) => attribute(b, 'type'))).toEqual(['button', 'button']);
  });

  // plan-session_list_improvements/REQ-1, REQ-2: no saved conversation, only "Dismiss"
  it('shows only "Dismiss" when not resumable', () => {
    const buttons = buttonsIn(renderToStaticMarkup(<EndedEntryActions sessionId="s1" resumable={false} />));
    expect(buttons.map((b) => attribute(b, 'aria-label'))).toEqual(['Dismiss']);
    expect(buttons.map((b) => attribute(b, 'title'))).toEqual(['Dismiss']);
  });

  // EndedEntryActions: no request runs and no error before the first press
  it('starts with no busy or disabled button and no error message', () => {
    const html = renderToStaticMarkup(<EndedEntryActions sessionId="s1" resumable />);
    expect(html).not.toContain('aria-disabled');
    expect(html).not.toContain('aria-busy');
    expect(html).not.toContain('role="alert"');
  });
});
