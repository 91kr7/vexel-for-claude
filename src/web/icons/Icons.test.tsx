import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleStopIcon, HistoryIcon, LogInIcon, PlusIcon, PowerIcon } from './Icons';

const icons: [string, ComponentType][] = [
  ['PlusIcon', PlusIcon],
  ['HistoryIcon', HistoryIcon],
  ['CircleStopIcon', CircleStopIcon],
  ['PowerIcon', PowerIcon],
  ['LogInIcon', LogInIcon],
];

const svgTag = (html: string) => html.match(/^<svg\b[^>]*>/)?.[0] ?? '';

describe('IconSet', () => {
  // IconSet: one inline SVG with the class "icon"
  it.each(icons)('%s renders one inline svg with the class "icon"', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(html).toMatch(/^<svg\b[\s\S]*<\/svg>$/);
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(svgTag(html)).toMatch(/\sclass="(?:[^"]*\s)?icon(?:\s[^"]*)?"/);
  });

  // IconSet: each icon is decorative, hidden from assistive technology and not focusable
  it.each(icons)('%s is aria-hidden and not focusable', (_, Icon) => {
    const tag = svgTag(renderToStaticMarkup(<Icon />));
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain('focusable="false"');
    expect(tag).not.toMatch(/\stabindex=/i);
    expect(tag).not.toMatch(/\s(?:aria-label|role)=/);
  });

  // IconSet: drawn in the current text colour
  it.each(icons)('%s paints only with currentColor', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(html).toContain('currentColor');
    const paints = [...html.matchAll(/\s(?:stroke|fill)="([^"]*)"/g)].map((m) => m[1]);
    for (const paint of paints) expect(['currentColor', 'none']).toContain(paint);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-6, IconSet: the SVG is inline and makes no network request
  it.each(icons)('%s references no external resource', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(html).not.toMatch(/\s(?:xlink:)?href=/);
    expect(html).not.toMatch(/url\(/);
    expect(html).not.toMatch(/<(?:image|use|foreignObject)\b/);
  });
});
