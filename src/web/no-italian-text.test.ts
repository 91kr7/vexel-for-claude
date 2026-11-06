import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['./**/*.{ts,tsx,html}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true });

/** Words of the former Italian UI, rare error texts included; none of them belongs to the English UI. */
const ITALIAN =
  /(?<![\p{L}\d_-])(?:sessione|sessioni|nuova|riprendi|annulla|apri|interrompi|termina|terminata|terminare|terminazione|rispondi|caricamento|cartella|cartelle|recenti|chiudi|lavora|richiede|richiedono|attesa|esterna|lettura|maiusc|elenco|terminale|utente|strumento|risultato|fatto|fallito|nuovi|nuovo|messaggi|messaggio|nessun|nessuna|impossibile|riuscito|riuscita|connessione|inserisci|leggibile|permesso|esecuzione|aperta|disconnessa|conversazione|scegli|progetto|progetti|passate|ancora|avvia|navigazione|principale|percorso|assoluto|ripresa|avvio|più)(?![\p{L}\d_-])|[àèìòù]/giu;

describe('frontend sources', () => {
  it('finds the frontend sources', () => {
    expect(Object.keys(sources)).toEqual(expect.arrayContaining(['./index.html', './AppLayout.tsx', './sessions/SessionView.tsx']));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-14: no Italian text left, rare states included
  it.each(Object.entries(sources))('%s holds no Italian UI word', (_file, source) => {
    const found = source.split('\n').flatMap((line, i) => (line.match(ITALIAN) ?? []).map((word) => `${i + 1}: ${word}`));
    expect(found).toEqual([]);
  });
});
