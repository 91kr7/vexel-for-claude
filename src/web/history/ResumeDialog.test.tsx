import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { HistoryIcon } from '../icons/Icons';
import { ResumeDialog } from './ResumeDialog';

const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', label: m[2]?.replace(/<[^>]*>/g, '').trim() }));

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

  // plan-claude_sessions_client-ui_redesign/REQ-25: "Annulla" and the primary "Riprendi", disabled while no entry is selected
  it('has "Annulla" and the primary action "Riprendi", disabled on open', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    const actions = buttons(html);
    expect(actions.map((b) => b.label)).toEqual(['Annulla', 'Riprendi']);
    const primary = actions[1]?.attrs ?? '';
    expect(primary).toMatch(/\sclass="(?:[^"]*\s)?button-primary(?:\s[^"]*)?"/);
    expect(primary).toMatch(/\sdisabled(?:=""|\s|$)/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-49, ResumeDialog: HistoryIcon on top and no description
  it('shows HistoryIcon before the title and has no accessible description', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    const icon = html.indexOf(renderToStaticMarkup(<HistoryIcon />));
    expect(icon).toBeGreaterThanOrEqual(0);
    expect(icon).toBeLessThan(html.indexOf('Riprendi sessione'));
    expect(html.match(/<[a-z]+\b[^>]*\srole="dialog"[^>]*>/)?.[0]).not.toContain('aria-describedby');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-29, ResumeDialog: the list loads behind a ProgressIndicator
  it('shows the ProgressIndicator "Caricamento…" while the past sessions load', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    expect(html).toContain(renderToStaticMarkup(<ProgressIndicator />));
    expect(html).not.toContain('role="alert"');
  });
});
