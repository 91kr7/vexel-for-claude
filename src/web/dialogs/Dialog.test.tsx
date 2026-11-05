import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Spinner } from '../feedback/ProgressIndicator';
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

  // plan-claude_sessions_client-ui_redesign/REQ-25: one cancel action, then one primary action
  it('has one action row: "Annulla" first, then the primary action', () => {
    expect(buttons(render()).map((b) => b.label)).toEqual(['Annulla', 'Conferma']);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-25: the primary action looks different from the cancel action
  it('styles only the primary action with the primary style', () => {
    const html = render();
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-primary');
    expect(classes(button(html, 'Annulla')?.attrs ?? '')).not.toContain('button-primary');
  });

  // Dialog: the content sits between the title and the action row
  it('places the content between the title and the action row', () => {
    const html = render();
    const title = html.indexOf('Titolo');
    const content = html.indexOf('Contenuto');
    const cancel = html.indexOf('Annulla');
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

  // Dialog: no description, no accessible description
  it('has no accessible description without a description', () => {
    expect(attr(roleTag(render(), 'dialog'), 'aria-describedby')).toBeUndefined();
  });

  // Dialog: primaryDisabled disables the primary action only; default false
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])('primaryDisabled=%s → primary disabled: %s, "Annulla" enabled', (primaryDisabled, disabled) => {
    const html = render(primaryDisabled === undefined ? {} : { primaryDisabled });
    expect(/\sdisabled(?:=""|\s|$)/.test(button(html, 'Conferma')?.attrs ?? '')).toBe(disabled);
    expect(button(html, 'Annulla')?.attrs).not.toMatch(/\sdisabled\b/);
  });

  // Dialog: formName is the accessible name of the form that holds the content and the action row
  it('names the form with formName and keeps the content and the actions inside it', () => {
    const html = render({ formName: 'Modulo del dialogo' });
    const form = html.match(/<form\b[^>]*>([\s\S]*)<\/form>/);
    expect(form).not.toBeNull();
    expect(form?.[0]).toMatch(/^<form\b[^>]*\saria-label="Modulo del dialogo"/);
    expect(form?.[1]).toContain('Contenuto');
    expect(form?.[1]).toContain('Annulla');
    expect(form?.[1]).toContain('Conferma');
  });

  // plan-claude_sessions_client-ui_redesign/REQ-28, Dialog: tone warning is an alert dialog with a danger primary
  it('tone warning → alertdialog with a danger primary action', () => {
    const html = render({ tone: 'warning' });
    const tag = roleTag(html, 'alertdialog');
    expect(tag).not.toBe('');
    expect(attr(tag, 'aria-modal')).toBe('true');
    expect(html).not.toContain('role="dialog"');
    expect(classes(button(html, 'Conferma')?.attrs ?? '')).toContain('button-danger');
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
});
