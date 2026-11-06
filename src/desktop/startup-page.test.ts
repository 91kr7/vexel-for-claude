// Tests of plan-desktop_app, batch desktop-window: StartupPage spec (REQ-7), and of plan-mac_title_bar, batch window-buttons (REQ-23). Colours and CSP are checked in the browser by e2e/desktop-window.spec.ts.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startupPageHtml, startupPageUrl } from './startup-page.js';

const LOADING = 'Starting the backend…';
const ERROR = 'The backend could not start.';

function decodeDataUrl(url: string): string {
  const comma = url.indexOf(',');
  const header = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  return header.endsWith(';base64') ? Buffer.from(payload, 'base64').toString('utf8') : decodeURIComponent(payload);
}

describe('startupPageHtml', () => {
  it('loading → a complete document with the title and the waiting text, no error text', () => {
    const html = startupPageHtml({ kind: 'loading' });
    expect(html.trimStart()).toMatch(/^<!doctype html>/i);
    expect(html.trimEnd()).toMatch(/<\/html>$/i);
    expect(html).toMatch(/<title>Vexel for Claude<\/title>/);
    expect(html).toContain(LOADING);
    expect(html).not.toContain(ERROR);
  });

  it('error → the error text and the output lines in the given order', () => {
    const lines = ['first output line', 'second output line', 'Backend exited with code 1.'];
    const html = startupPageHtml({ kind: 'error', outputLines: lines });
    expect(html).toMatch(/<title>Vexel for Claude<\/title>/);
    expect(html).toContain(ERROR);
    expect(html).not.toContain(LOADING);
    const positions = lines.map((line) => html.indexOf(line));
    expect(positions.every((position) => position > html.indexOf(ERROR))).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('error → HTML in an output line is escaped, never interpreted', () => {
    const html = startupPageHtml({ kind: 'error', outputLines: ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'a & b'] });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
  });

  // StartupPage rule, plan-mac_title_bar/REQ-23: one inline script, the only one the page policy allows, by its SHA-256 hash
  it.each([{ kind: 'loading' as const }, { kind: 'error' as const, outputLines: ['x'] }])(
    '$kind → one inline script, allowed by its hash and nothing else',
    (state) => {
      const html = startupPageHtml(state);
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
      expect(scripts).toHaveLength(1);
      expect(scripts[0]![1], 'no external source').not.toMatch(/\ssrc=/i);
      const policy = html.match(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i)?.[1];
      expect(policy, 'the page declares its policy').toBeDefined();
      const scriptSrc = policy!.split(';').map((directive) => directive.trim()).find((directive) => directive.startsWith('script-src '));
      const hash = createHash('sha256').update(scripts[0]![2]!).digest('base64');
      expect(scriptSrc).toBe(`script-src 'sha256-${hash}'`);
    },
  );
});

describe('startupPageUrl', () => {
  it.each([{ kind: 'loading' as const }, { kind: 'error' as const, outputLines: ['line with spaces, # and %'] }])(
    '$kind → a data:text/html URL of the same document',
    (state) => {
      const url = startupPageUrl(state);
      expect(url).toMatch(/^data:text\/html[;,]/);
      expect(decodeDataUrl(url)).toBe(startupPageHtml(state));
    },
  );
});
