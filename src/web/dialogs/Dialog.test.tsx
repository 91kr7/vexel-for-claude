import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Spinner } from '../feedback/ProgressIndicator';
import { TriangleAlertIcon } from '../icons/Icons';
import { Dialog, type DialogProps } from './Dialog';

const buttons = (html: string) =>
  [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', label: m[2]?.replace(/<[^>]*>/g, '').trim() }));
const button = (html: string, label: string) => buttons(html).find((b) => b.label === label);
const classes = (attrs: string) => attrs.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const roleTag = (html: string, role: string) => html.match(new RegExp(`<[a-z]+\\b[^>]*\\srole="${role}"[^>]*>`))?.[0] ?? '';
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const textOfId = (html: string, id: string) =>
  html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</\\1>`))?.[2]?.replace(/<[^>]*>/g, '').trim();

const render = (props: Partial<DialogProps> = {}) =>
  renderToStaticMarkup(
    <Dialog title="Titolo" primaryLabel="Conferma" onPrimary={() => {}} onCancel={() => {}} {...props}>
      <p>Contenuto</p>
    </Dialog>,
  );

describe('Dialog', () => {
  // plan-claude_sessions_client-ui_redesign/REQ-25, Dialog: default tone is a modal dialog named by its title
  it('is a modal dialog whose accessible name is the title', () => {
    const html = render();
    const tag = roleTag(html, 'dialog');
    expect(tag).not.toBe('');
    expect(attr(tag, 'aria-modal')).toBe('true');
    const labelledBy = attr(tag, 'aria-labelledby');
    expect(labelledBy).toBeDefined();
    expect(textOfId(html, labelledBy ?? '')).toBe('Titolo');
    expect(html).not.toContain('role="alertdialog"');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44, plan-claude_sessions_client-ui_redesign/REQ-25: "[Esc]" in the header, then "Cancel" and the primary action
  it('has "[Esc]" in the header, then "Cancel" and the primary action', () => {
    expect(buttons(render()).map((b) => b.label)).toEqual(['[Esc]', 'Cancel', 'Conferma']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44, Dialog "Actions": the "[Esc]" button is named "Close (Esc)" and sits after the title
  it('names "[Esc]" "Close (Esc)" and places it after the title', () => {
    const html = render();
    const esc = button(html, '[Esc]');
    expect(attr(esc?.attrs ?? '', 'aria-label')).toBe('Close (Esc)');
    expect(attr(esc?.attrs ?? '', 'type')).toBe('button');
    expect(html.indexOf('[Esc]')).toBeGreaterThan(html.indexOf('Titolo'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44: the accent dot before the title is decorative
  it('shows a decorative element before the title and no icon', () => {
    const head = render().split('Titolo')[0] ?? '';
    expect(head).toMatch(/<span\b[^>]*aria-hidden="true"[^>]*>\s*<\/span>/);
    expect(head).not.toContain('<svg');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-47: "Cancel" neutral, primary action accent
  it('styles "Cancel" as .button-neutral and the primary action as .button-primary', () => {
    const html = render();
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-primary');
    expect(classes(button(html, 'Cancel')?.attrs ?? '')).toContain('button-neutral');
    expect(classes(button(html, 'Cancel')?.attrs ?? '')).not.toContain('button-primary');
  });

  // Dialog: the content sits between the title and the action row
  it('places the content between the title and the action row', () => {
    const html = render();
    const title = html.indexOf('Titolo');
    const content = html.indexOf('Contenuto');
    const cancel = html.indexOf('Cancel');
    expect(title).toBeGreaterThanOrEqual(0);
    expect(content).toBeGreaterThan(title);
    expect(cancel).toBeGreaterThan(content);
  });

  // Dialog: the description is the accessible description of the dialog
  it('uses the description as the accessible description', () => {
    const html = render({ description: 'Spiegazione del dialogo.' });
    const describedBy = attr(roleTag(html, 'dialog'), 'aria-describedby');
    expect(describedBy).toBeDefined();
    expect(textOfId(html, describedBy ?? '')).toBe('Spiegazione del dialogo.');
  });

  // Dialog: the description accepts markup, and its whole text is the accessible description
  it('keeps markup in the description and describes the dialog with its text', () => {
    const html = render({ description: <><b>billing-api</b> is still working.</> });
    expect(html).toContain('<b>billing-api</b> is still working.');
    const describedBy = attr(roleTag(html, 'dialog'), 'aria-describedby');
    expect(textOfId(html, describedBy ?? '')).toBe('billing-api is still working.');
  });

  // Dialog "Shows": the description sits at the top of the body, before the content
  it('places the description before the content', () => {
    const html = render({ description: 'Spiegazione del dialogo.' });
    expect(html.indexOf('Spiegazione del dialogo.')).toBeGreaterThan(html.indexOf('Titolo'));
    expect(html.indexOf('Spiegazione del dialogo.')).toBeLessThan(html.indexOf('Contenuto'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44: a warning tone has no icon before the title either
  it('warning tone → no icon before the title', () => {
    const head = render({ tone: 'warning' }).split('Titolo')[0] ?? '';
    expect(head).not.toContain('<svg');
  });

  // Dialog: no description, no accessible description
  it('has no accessible description without a description', () => {
    expect(attr(roleTag(render(), 'dialog'), 'aria-describedby')).toBeUndefined();
  });

  // Dialog: primaryDisabled disables the primary action only; default false
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])('primaryDisabled=%s → primary disabled: %s, "Cancel" enabled', (primaryDisabled, disabled) => {
    const html = render(primaryDisabled === undefined ? {} : { primaryDisabled });
    expect(/\sdisabled(?:=""|\s|$)/.test(button(html, 'Conferma')?.attrs ?? '')).toBe(disabled);
    expect(button(html, 'Cancel')?.attrs).not.toMatch(/\sdisabled\b/);
  });

  // Dialog: formName is the accessible name of the form that holds the body and the footer
  it('names the form with formName and keeps the content and the footer actions inside it', () => {
    const html = render({ formName: 'Modulo del dialogo' });
    const form = html.match(/<form\b[^>]*>([\s\S]*)<\/form>/);
    expect(form).not.toBeNull();
    expect(form?.[0]).toMatch(/^<form\b[^>]*\saria-label="Modulo del dialogo"/);
    expect(form?.[1]).toContain('Contenuto');
    expect(form?.[1]).toContain('Cancel');
    expect(form?.[1]).toContain('Conferma');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-28, plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-48: tone warning is an alert dialog with a rose primary
  it('tone warning → alertdialog with a .button-danger primary action', () => {
    const html = render({ tone: 'warning' });
    const tag = roleTag(html, 'alertdialog');
    expect(tag).not.toBe('');
    expect(attr(tag, 'aria-modal')).toBe('true');
    expect(html).not.toContain('role="dialog"');
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-danger');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49: warning tone with accent attn → amber primary and the description in a banner with the triangle
  it('tone warning, accent attn → .button-attn primary and the triangle icon before the description', () => {
    const html = render({ tone: 'warning', accent: 'attn', description: 'Testo di avviso.' });
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-attn');
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).not.toContain('button-danger');
    const triangle = html.indexOf(renderToStaticMarkup(<TriangleAlertIcon />));
    expect(triangle).toBeGreaterThan(html.indexOf('Titolo'));
    expect(triangle).toBeLessThan(html.indexOf('Testo di avviso.'));
  });

  // Dialog: the accent has no effect on the default tone
  it('default tone with accent attn keeps the .button-primary primary action and no triangle', () => {
    const html = render({ accent: 'attn', description: 'Testo.' });
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-primary');
    expect(html).not.toContain('<svg');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-31, Dialog: a busy primary action shows the spinner, is disabled and keeps its name
  it('primaryBusy → the primary action has the spinner, is disabled, aria-busy and keeps its name', () => {
    const busy = button(render({ primaryBusy: true }), 'Conferma');
    expect(busy, 'the primary action keeps its name').toBeDefined();
    expect(busy?.attrs).toMatch(/\sdisabled(?:=""|\s|$)/);
    expect(attr(busy?.attrs ?? '', 'aria-busy')).toBe('true');
    expect(render({ primaryBusy: true })).toContain(renderToStaticMarkup(<Spinner />));
  });

  // Dialog: primaryBusy defaults to false
  it('without primaryBusy the primary action is enabled, not busy and has no spinner', () => {
    const idle = button(render(), 'Conferma');
    expect(idle?.attrs).not.toMatch(/\sdisabled(?:=""|\s|$)/);
    expect(idle?.attrs).not.toContain('aria-busy="true"');
    expect(render()).not.toContain(renderToStaticMarkup(<Spinner />));
  });

  // plan-keyboard_shortcuts/REQ-29, REQ-33, Dialog: with no primary action the footer has one neutral "Close" in place of "Cancel"
  it('without a primary action shows "[Esc]" and one neutral "Close", with no "Cancel" and no primary button', () => {
    const html = renderToStaticMarkup(
      <Dialog title="Titolo" onCancel={() => {}}>
        <p>Contenuto</p>
      </Dialog>,
    );
    expect(buttons(html).map((b) => b.label)).toEqual(['[Esc]', 'Close']);
    const close = button(html, 'Close');
    expect(classes(close?.attrs ?? '')).toContain('button-neutral');
    expect(attr(close?.attrs ?? '', 'type')).toBe('button');
    expect(html).not.toContain('button-primary');
  });
});
