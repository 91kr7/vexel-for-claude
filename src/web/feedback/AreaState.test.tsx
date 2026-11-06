import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleXIcon, HistoryIcon, SquareTerminalIcon } from '../icons/Icons';
import { AreaState } from './AreaState';
import { Spinner } from './ProgressIndicator';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const rootTag = (html: string) => html.match(/^<\w+\b[^>]*>/)?.[0] ?? '';
const classesOf = (tag: string) => tag.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

describe('AreaState', () => {
  // AreaState "Shows": role status for loading, alert for error, none for empty
  it.each([
    ['loading', 'status'],
    ['error', 'alert'],
  ] as const)('%s has the role %s', (kind, role) => {
    expect(rootTag(renderToStaticMarkup(<AreaState kind={kind} title="Titolo" />))).toContain(`role="${role}"`);
  });

  it('empty has no role', () => {
    expect(renderToStaticMarkup(<AreaState kind="empty" title="Titolo" />)).not.toMatch(/\srole=/);
  });

  // AreaState "Shows": a .vx-surface-1 block
  it('is a .vx-surface-1 block', () => {
    expect(classesOf(rootTag(renderToStaticMarkup(<AreaState kind="empty" title="Titolo" />)))).toContain('vx-surface-1');
  });

  // AreaState "Shows": the text is the title, then the optional text; the tile adds none
  it('has the title, then the text, as its only text', () => {
    expect(textOf(renderToStaticMarkup(<AreaState kind="error" title="Errore." text="Riprova." />))).toBe('Errore. Riprova.');
    expect(textOf(renderToStaticMarkup(<AreaState kind="loading" title="Loading…" />))).toBe('Loading…');
  });

  // AreaState "Shows": the tile is decorative and comes first
  it('starts with a decorative tile', () => {
    const html = renderToStaticMarkup(<AreaState kind="empty" title="Titolo" />);
    const inner = html.replace(/^<\w+\b[^>]*>/, '');
    expect(inner).toMatch(/^<\w+\b[^>]*aria-hidden="true"/);
    expect(inner.indexOf('aria-hidden="true"')).toBeLessThan(inner.indexOf('Titolo'));
  });

  // AreaState props: default icons per kind
  it.each([
    ['empty', renderToStaticMarkup(<SquareTerminalIcon />)],
    ['loading', renderToStaticMarkup(<Spinner />)],
    ['error', renderToStaticMarkup(<CircleXIcon />)],
  ] as const)('%s shows its default icon in the tile', (kind, icon) => {
    expect(renderToStaticMarkup(<AreaState kind={kind} title="Titolo" />)).toContain(icon);
  });

  // AreaState props: a given icon replaces the default
  it('shows the given icon in place of the default', () => {
    const html = renderToStaticMarkup(<AreaState kind="empty" title="Titolo" icon={<HistoryIcon />} />);
    expect(html).toContain(renderToStaticMarkup(<HistoryIcon />));
    expect(html).not.toContain(renderToStaticMarkup(<SquareTerminalIcon />));
  });

  // AreaState props: the actions sit under the texts
  it('places the actions after the texts', () => {
    const html = renderToStaticMarkup(<AreaState kind="empty" title="Titolo" text="Testo" actions={<button type="button">Azione</button>} />);
    expect(html.indexOf('<button')).toBeGreaterThan(html.indexOf('Testo'));
  });

  // AreaState props: full is the default size, compact differs
  it('renders full by default, and compact differently', () => {
    const full = renderToStaticMarkup(<AreaState kind="empty" title="Titolo" size="full" />);
    expect(renderToStaticMarkup(<AreaState kind="empty" title="Titolo" />)).toBe(full);
    expect(renderToStaticMarkup(<AreaState kind="empty" title="Titolo" size="compact" />)).not.toBe(full);
  });

  // AreaState props: className adds a class
  it('adds className to the block', () => {
    expect(classesOf(rootTag(renderToStaticMarkup(<AreaState kind="empty" title="Titolo" className="extra" />)))).toContain('extra');
  });
});
