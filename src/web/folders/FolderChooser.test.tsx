import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FolderChooser } from './FolderChooser';

const render = () => renderToStaticMarkup(<FolderChooser onStarted={() => {}} onCancel={() => {}} />);
const buttonLabels = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]?.replace(/<[^>]*>/g, '').trim());
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const textOfId = (html: string, id: string) =>
  html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</\\1>`))?.[2]?.replace(/<[^>]*>/g, '').trim();

describe('FolderChooser', () => {
  // FolderChooser "Description", plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-44: title and description, no icon before the title
  it('is the dialog "Nuova sessione" with its description and no icon before the title', () => {
    const html = render();
    const dialog = html.match(/<[a-z]+\b[^>]*\srole="dialog"[^>]*>/)?.[0] ?? '';
    expect(textOfId(html, attr(dialog, 'aria-labelledby') ?? '')).toBe('Nuova sessione');
    expect(textOfId(html, attr(dialog, 'aria-describedby') ?? '')).toBe('Scegli il progetto in cui avviare Claude Code.');
    expect(html.slice(0, html.indexOf('Nuova sessione'))).not.toContain('<svg');
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-46: the field "Cartella del progetto", label above, no icon; then "Annulla" and "Avvia sessione"
  it('has the field "Cartella del progetto" with its label above the input and no icon, and the buttons "Annulla" and "Avvia sessione"', () => {
    const html = render();
    const label = html.match(/<label\b[^>]*>([\s\S]*?)<\/label>/)?.[1] ?? '';
    const name = label.indexOf('Cartella del progetto');
    expect(name).toBeGreaterThanOrEqual(0);
    expect(label.search(/<input\b/)).toBeGreaterThan(name);
    expect(label).not.toContain('<svg');
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
