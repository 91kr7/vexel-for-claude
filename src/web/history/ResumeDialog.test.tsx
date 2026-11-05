import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResumeDialog } from './ResumeDialog';

describe('ResumeDialog', () => {
  // plan-claude_sessions_client/REQ-25: before the past sessions arrive
  it('opens as a modal titled "Riprendi sessione", shows "Caricamento…" and the button "Annulla"', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Riprendi sessione');
    expect(html).toContain('Caricamento…');
    expect(html).toMatch(/<button[^>]*>Annulla<\/button>/);
  });
});
