import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AreaState } from '../feedback/AreaState';
import { ResumeDialog } from './ResumeDialog';

const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', label: m[2]?.replace(/<[^>]*>/g, '').trim() }));

describe('ResumeDialog', () => {
  // plan-claude_sessions_client/REQ-25: before the past sessions arrive
  it('opens as a modal titled "Resume Session", shows "Loading…" and the button "Cancel"', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Resume Session');
    expect(html).toContain('Loading…');
    expect(html).toMatch(/<button[^>]*>Cancel<\/button>/);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-25: "Cancel" and the primary "Resume", disabled while no entry is selected
  it('has "Cancel" and the primary action "Resume", disabled on open', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    const actions = buttons(html);
    expect(actions.map((b) => b.label)).toEqual(['[Esc]', 'Cancel', 'Resume']);
    const primary = actions[2]?.attrs ?? '';
    expect(primary).toMatch(/\sclass="(?:[^"]*\s)?button-primary(?:\s[^"]*)?"/);
    expect(primary).toMatch(/\sdisabled(?:=""|\s|$)/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44, ResumeDialog: no icon before the title and no description
  it('shows no icon before the title and has no accessible description', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    expect(html.slice(0, html.indexOf('Resume Session'))).not.toContain('<svg');
    expect(html.match(/<[a-z]+\b[^>]*\srole="dialog"[^>]*>/)?.[0]).not.toContain('aria-describedby');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-50, ResumeDialog: the list loads behind a compact AreaState
  it('shows the compact AreaState "Loading…" while the past sessions load', () => {
    const html = renderToStaticMarkup(<ResumeDialog onResumed={() => {}} onCancel={() => {}} />);
    expect(html).toContain(renderToStaticMarkup(<AreaState kind="loading" size="compact" title="Loading…" />));
    expect(html).not.toContain('role="alert"');
  });
});
