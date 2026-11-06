import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TriangleAlertIcon } from '../icons/Icons';
import { RunningElsewhereWarning } from './RunningElsewhereWarning';

const buttonLabels = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.replace(/<[^>]*>/g, '').trim());

describe('RunningElsewhereWarning', () => {
  // plan-claude_sessions_client/REQ-27
  it('is a modal alert dialog with the title, the risk text and the buttons "Cancel" and "Resume Anyway"', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Session Running in a Terminal');
    expect(html).toContain(
      'This session is still running in another terminal. If you resume it here too, the two instances can damage the conversation.',
    );
    expect(buttonLabels(html)).toEqual(['[Esc]', 'Cancel', 'Resume Anyway']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: the triangle sits in the banner, after the title and before the text
  it('shows TriangleAlertIcon after the title and before the risk text', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    const icon = html.indexOf(renderToStaticMarkup(<TriangleAlertIcon />));
    expect(icon).toBeGreaterThan(html.indexOf('Session Running in a Terminal'));
    expect(icon).toBeLessThan(html.indexOf('This session is still'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: "Resume Anyway" is the amber primary action
  it('styles "Resume Anyway" as the .button-attn primary action', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    const primary = html.match(/<button([^>]*)>(?:(?!<\/button>)[\s\S])*Resume Anyway/)?.[1] ?? '';
    expect(primary).toMatch(/\sclass="(?:[^"]*\s)?button-attn(?:\s[^"]*)?"/);
  });
});
