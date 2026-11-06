import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TriangleAlertIcon } from '../icons/Icons';
import { RunningElsewhereWarning } from './RunningElsewhereWarning';

const buttonLabels = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.replace(/<[^>]*>/g, '').trim());

describe('RunningElsewhereWarning', () => {
  // plan-claude_sessions_client/REQ-27
  it('is a modal alert dialog with the title, the risk text and the buttons "Annulla" and "Riprendi comunque"', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Sessione in esecuzione in un terminale');
    expect(html).toContain(
      'Questa sessione è ancora in esecuzione in un altro terminale. Se la riprendi anche qui, le due istanze possono danneggiare la conversazione.',
    );
    expect(buttonLabels(html)).toEqual(['[Esc]', 'Annulla', 'Riprendi comunque']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: the triangle sits in the banner, after the title and before the text
  it('shows TriangleAlertIcon after the title and before the risk text', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    const icon = html.indexOf(renderToStaticMarkup(<TriangleAlertIcon />));
    expect(icon).toBeGreaterThan(html.indexOf('Sessione in esecuzione in un terminale'));
    expect(icon).toBeLessThan(html.indexOf('Questa sessione è ancora'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: "Riprendi comunque" is the amber primary action
  it('styles "Riprendi comunque" as the .button-attn primary action', () => {
    const html = renderToStaticMarkup(<RunningElsewhereWarning onConfirm={() => {}} onCancel={() => {}} />);
    const primary = html.match(/<button([^>]*)>(?:(?!<\/button>)[\s\S])*Riprendi comunque/)?.[1] ?? '';
    expect(primary).toMatch(/\sclass="(?:[^"]*\s)?button-attn(?:\s[^"]*)?"/);
  });
});
