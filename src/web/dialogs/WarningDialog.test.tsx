import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TriangleAlertIcon } from '../icons/Icons';
import { WarningDialog } from './WarningDialog';

const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', label: m[2]?.replace(/<[^>]*>/g, '').trim() }));
const classes = (attrs: string) => attrs.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

const render = (accent?: 'error' | 'attn') =>
  renderToStaticMarkup(
    <WarningDialog title="Azione rischiosa" description="Testo del rischio." primaryLabel="Procedi" onPrimary={() => {}} onCancel={() => {}} accent={accent}>
      <p>Contenuto</p>
    </WarningDialog>,
  );

describe('WarningDialog', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-28, WarningDialog: role alertdialog, modal
  it('is a modal alert dialog', () => {
    const html = render();
    expect(html).toMatch(/<[a-z]+\b[^>]*\srole="alertdialog"[^>]*\saria-modal="true"|<[a-z]+\b[^>]*\saria-modal="true"[^>]*\srole="alertdialog"/);
    expect(html).not.toContain('role="dialog"');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-48: "[Esc]", "Annulla" neutral, then the rose primary action
  it('error (default) → "[Esc]", "Annulla" as .button-neutral and the primary action as .button-danger', () => {
    const [esc, cancel, primary, ...rest] = buttons(render());
    expect(rest).toEqual([]);
    expect(esc?.label).toBe('[Esc]');
    expect(cancel?.label).toBe('Annulla');
    expect(classes(cancel?.attrs ?? '')).toContain('button-neutral');
    expect(primary?.label).toBe('Procedi');
    expect(classes(primary?.attrs ?? '')).toContain('button-danger');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: attn → amber primary action
  it('attn → the primary action is .button-attn', () => {
    const primary = buttons(render('attn'))[2];
    expect(primary?.label).toBe('Procedi');
    expect(classes(primary?.attrs ?? '')).toContain('button-attn');
    expect(classes(primary?.attrs ?? '')).not.toContain('button-danger');
  });

  // WarningDialog spec: the frame has no icon; only attn shows the triangle, inside the banner before the text
  it('error → no icon at all', () => {
    expect(render('error')).not.toContain('<svg');
  });

  it('attn → one triangle icon, after the title and before the text', () => {
    const html = render('attn');
    const triangle = renderToStaticMarkup(<TriangleAlertIcon />);
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html.indexOf(triangle)).toBeGreaterThan(html.indexOf('Azione rischiosa'));
    expect(html.indexOf(triangle)).toBeLessThan(html.indexOf('Testo del rischio.'));
  });
});
