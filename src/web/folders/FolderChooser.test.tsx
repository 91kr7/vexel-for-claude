import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FolderIcon, FolderPlusIcon } from '../icons/Icons';
import { FolderChooser } from './FolderChooser';

const render = () => renderToStaticMarkup(<FolderChooser onStarted={() => {}} onCancel={() => {}} />);
const buttonLabels = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.replace(/<[^>]*>/g, '').trim());
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const textOfId = (html: string, id: string) =>
  html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</\\1>`))?.[2]?.replace(/<[^>]*>/g, '').trim();

describe('FolderChooser', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44, FolderChooser: FolderPlusIcon, title and description of the board
  it('is the dialog "Nuova sessione" with FolderPlusIcon on top and the board description', () => {
    const html = render();
    const dialog = html.match(/<[a-z]+\b[^>]*\srole="dialog"[^>]*>/)?.[0] ?? '';
    expect(textOfId(html, attr(dialog, 'aria-labelledby') ?? '')).toBe('Nuova sessione');
    expect(textOfId(html, attr(dialog, 'aria-describedby') ?? '')).toBe('Scegli il progetto in cui avviare Claude Code.');
    const icon = html.indexOf(renderToStaticMarkup(<FolderPlusIcon />));
    expect(icon).toBeGreaterThanOrEqual(0);
    expect(icon).toBeLessThan(html.indexOf('Nuova sessione'));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44: the field "Cartella del progetto" with FolderIcon, then "Annulla" and "Avvia sessione"
  it('has the field "Cartella del progetto" with FolderIcon before the input, and the buttons "Annulla" and "Avvia sessione"', () => {
    const html = render();
    const label = html.match(/<label\b[^>]*>([\s\S]*?)<\/label>/)?.[1] ?? '';
    expect(label.replace(/<[^>]*>/g, '')).toContain('Cartella del progetto');
    const input = label.search(/<input\b/);
    expect(input).toBeGreaterThanOrEqual(0);
    const icon = label.indexOf(renderToStaticMarkup(<FolderIcon />));
    expect(icon).toBeGreaterThanOrEqual(0);
    expect(icon).toBeLessThan(input);
    expect(buttonLabels(html).slice(-2)).toEqual(['Annulla', 'Avvia sessione']);
  });

  // FolderChooser: before PastSessionListRoute answers, no "Recenti" heading and no group; "Cartelle" is there
  it('shows no "Recenti" and no radio group before the past sessions load, and shows the heading "Cartelle"', () => {
    const html = render();
    expect(html).not.toContain('Recenti');
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toMatch(/>Cartelle</);
  });
});
