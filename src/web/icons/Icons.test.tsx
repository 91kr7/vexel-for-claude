import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CircleAlertIcon,
  CircleOffIcon,
  CirclePauseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStopIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LockIcon,
  LogInIcon,
  PlusIcon,
  PowerIcon,
  TerminalIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from './Icons';

const icons: [string, ComponentType][] = [
  ['PlusIcon', PlusIcon],
  ['HistoryIcon', HistoryIcon],
  ['CircleStopIcon', CircleStopIcon],
  ['PowerIcon', PowerIcon],
  ['LogInIcon', LogInIcon],
  ['LoaderCircleIcon', LoaderCircleIcon],
  ['CircleAlertIcon', CircleAlertIcon],
  ['TriangleAlertIcon', TriangleAlertIcon],
  ['CirclePauseIcon', CirclePauseIcon],
  ['CircleOffIcon', CircleOffIcon],
  ['TerminalIcon', TerminalIcon],
  ['LockIcon', LockIcon],
  ['WrenchIcon', WrenchIcon],
  ['ChevronRightIcon', ChevronRightIcon],
  ['ChevronDownIcon', ChevronDownIcon],
];

const svgTag = (html: string) => html.match(/^<svg\b[^>]*>/)?.[0] ?? '';

/** Each subpath in a canonical form: polylines (M, L, H, V) as absolute points, other subpaths as written. */
function subpathsOf(paths: string[]): string[] {
  const out: string[] = [];
  for (const d of paths) {
    const parts = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
    let x = 0;
    let y = 0;
    let points: string[] = [];
    let raw = '';
    let polyline = true;
    const flush = () => {
      if (raw) out.push(polyline ? points.join(' ') : raw.trim());
      points = [];
      raw = '';
      polyline = true;
    };
    for (const [index, part] of parts.entries()) {
      const command = part[0]!;
      const numbers = (part.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
      const relative = command === command.toLowerCase() && index > 0;
      if (command === 'M' || command === 'm') flush();
      raw += index === 0 ? command.toUpperCase() + part.slice(1) : part;
      switch (command.toUpperCase()) {
        case 'M':
        case 'L':
          for (let i = 0; i + 1 < numbers.length; i += 2) {
            const fromCurrent = i === 0 ? relative : command === command.toLowerCase();
            x = (fromCurrent ? x : 0) + numbers[i]!;
            y = (fromCurrent ? y : 0) + numbers[i + 1]!;
            points.push(`${x},${y}`);
          }
          break;
        case 'H':
          for (const n of numbers) points.push(`${(x = (relative ? x : 0) + n)},${y}`);
          break;
        case 'V':
          for (const n of numbers) points.push(`${x},${(y = (relative ? y : 0) + n)}`);
          break;
        default:
          polyline = false;
      }
    }
    flush();
  }
  return out.sort();
}

/** Subpaths drawn by the paths and lines of an icon, in the canonical form of subpathsOf. */
function drawnShapes(html: string): string[] {
  const paths = [...html.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((m) => m[1]!);
  for (const line of html.matchAll(/<line\b([^>]*)>/g)) {
    const at = (name: string) => line[1]!.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '0';
    paths.push(`M${at('x1')} ${at('y1')}L${at('x2')} ${at('y2')}`);
  }
  return subpathsOf(paths);
}

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

  // IconSet rule: an icon the board draws takes its path data from the board (proposta-sessione-ospitata.html)
  it.each<[string, ComponentType, string[]]>([
    ['PlusIcon', PlusIcon, ['M12 5v14M5 12h14']],
    ['TerminalIcon', TerminalIcon, ['m4 17 6-6-6-6', 'M12 19h8']],
    ['HistoryIcon', HistoryIcon, ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2']],
    ['CircleAlertIcon', CircleAlertIcon, ['M12 8v4', 'M12 16h.01']],
  ])('%s draws the shapes of the board', (_, Icon, boardPaths) => {
    expect(drawnShapes(renderToStaticMarkup(<Icon />))).toEqual(subpathsOf(boardPaths));
  });

  // IconSet rule: the circle-alert of the board keeps its circle
  it('CircleAlertIcon draws the circle of the board', () => {
    expect(renderToStaticMarkup(<CircleAlertIcon />)).toMatch(/<circle\b(?=[^>]*\scx="12")(?=[^>]*\scy="12")(?=[^>]*\sr="10")[^>]*>/);
  });

  // plan-claude_sessions_client-ui_redesign/REQ-6, IconSet: the SVG is inline and makes no network request
  it.each(icons)('%s references no external resource', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(html).not.toMatch(/\s(?:xlink:)?href=/);
    expect(html).not.toMatch(/url\(/);
    expect(html).not.toMatch(/<(?:image|use|foreignObject)\b/);
  });
});
