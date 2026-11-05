import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WarningDialog } from './WarningDialog';

const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', label: m[2]?.replace(/<[^>]*>/g, '').trim() }));
const classes = (attrs: string) => attrs.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

const render = () =>
  renderToStaticMarkup(
    <WarningDialog title="Azione rischiosa" primaryLabel="Procedi" onPrimary={() => {}} onCancel={() => {}}>
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

  // plan-claude_sessions_client-ui_redesign/REQ-25, REQ-28: "Annulla", then the primary action in the danger style
  it('has "Annulla" and a danger-styled primary action', () => {
    const [cancel, primary, ...rest] = buttons(render());
    expect(rest).toEqual([]);
    expect(cancel?.label).toBe('Annulla');
    expect(primary?.label).toBe('Procedi');
    expect(classes(primary?.attrs ?? '')).toContain('button-danger');
    expect(classes(cancel?.attrs ?? '')).not.toContain('button-danger');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-28, WarningDialog: a warning icon before the title
  it('shows a decorative icon before the title', () => {
    const html = render();
    const icon = html.search(/<svg\b[^>]*aria-hidden="true"/);
    expect(icon).toBeGreaterThanOrEqual(0);
    expect(icon).toBeLessThan(html.indexOf('Azione rischiosa'));
  });
});
