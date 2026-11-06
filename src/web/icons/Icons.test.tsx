import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ArrowDownIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleMinusIcon,
  CircleOffIcon,
  CirclePauseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleStopIcon,
  CircleXIcon,
  FolderIcon,
  FolderPlusIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LockIcon,
  LogInIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SparkIcon,
  SunIcon,
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
  ['CircleMinusIcon', CircleMinusIcon],
  ['TerminalIcon', TerminalIcon],
  ['LockIcon', LockIcon],
  ['WrenchIcon', WrenchIcon],
  ['ChevronRightIcon', ChevronRightIcon],
  ['ChevronDownIcon', ChevronDownIcon],
  ['ChevronUpIcon', ChevronUpIcon],
  ['PencilIcon', PencilIcon],
  ['CheckIcon', CheckIcon],
  ['ArrowDownIcon', ArrowDownIcon],
  ['FolderIcon', FolderIcon],
  ['FolderPlusIcon', FolderPlusIcon],
  ['SunIcon', SunIcon],
  ['MoonIcon', MoonIcon],
];

const FOLDER = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

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

  // IconSet rule and plan-claude_sessions_client-ui_redesign-material3_mock/REQ-39, REQ-40, REQ-41: the icons drawn by proposta-sessione-esterna.html
  it.each<[string, ComponentType, string[]]>([
    ['PencilIcon', PencilIcon, ['M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z']],
    ['CheckIcon', CheckIcon, ['M20 6 9 17l-5-5']],
    ['ArrowDownIcon', ArrowDownIcon, ['M12 5v14', 'm19 12-7 7-7-7']],
    ['ChevronRightIcon', ChevronRightIcon, ['m9 18 6-6-6-6']],
    ['ChevronDownIcon', ChevronDownIcon, ['m6 9 6 6 6-6']],
    ['CircleXIcon', CircleXIcon, ['m15 9-6 6', 'm9 9 6 6']],
    ['LogInIcon', LogInIcon, ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3']],
  ])('%s draws the shapes of board "Sessione esterna"', (_, Icon, boardPaths) => {
    expect(drawnShapes(renderToStaticMarkup(<Icon />))).toEqual(subpathsOf(boardPaths));
  });

  // IconSet rule and plan-claude_sessions_client-ui_redesign-material3_mock/REQ-44, REQ-47: the icons drawn by proposta-dialoghi.html
  it.each<[string, ComponentType, string[]]>([
    ['FolderPlusIcon', FolderPlusIcon, ['M12 10v6', 'M9 13h6', FOLDER]],
    ['FolderIcon', FolderIcon, [FOLDER]],
    ['PowerIcon', PowerIcon, ['M12 2v10', 'M18.4 6.6a9 9 0 1 1-12.77.04']],
  ])('%s draws the shapes of board "Dialoghi"', (_, Icon, boardPaths) => {
    expect(drawnShapes(renderToStaticMarkup(<Icon />))).toEqual(subpathsOf(boardPaths));
  });

  // IconSet and plan-terminal_addons/REQ-25: "Previous match" uses Lucide chevron-up
  it('ChevronUpIcon draws the Lucide chevron-up', () => {
    expect(drawnShapes(renderToStaticMarkup(<ChevronUpIcon />))).toEqual(subpathsOf(['m18 15-6-6-6 6']));
  });

  it('CircleXIcon draws the circle of board "Sessione esterna"', () => {
    expect(renderToStaticMarkup(<CircleXIcon />)).toMatch(/<circle\b(?=[^>]*\scx="12")(?=[^>]*\scy="12")(?=[^>]*\sr="10")[^>]*>/);
  });

  // IconSet: SparkIcon is the ember four-point star of the board, a filled shape with the class "spark"
  it('SparkIcon is one decorative inline svg with the class "spark", filled with currentColor, with the star of the board', () => {
    const html = renderToStaticMarkup(<SparkIcon />);
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    const tag = svgTag(html);
    expect(tag).toMatch(/\sclass="(?:[^"]*\s)?spark(?:\s[^"]*)?"/);
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain('focusable="false"');
    expect(tag).not.toMatch(/\s(?:aria-label|role|tabindex)=/i);
    const fills = [...html.matchAll(/\sfill="([^"]*)"/g)].map((m) => m[1]);
    expect(fills).toContain('currentColor');
    for (const paint of [...html.matchAll(/\s(?:stroke|fill)="([^"]*)"/g)].map((m) => m[1])) expect(['currentColor', 'none']).toContain(paint);
    expect(drawnShapes(html)).toEqual(subpathsOf(['M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z']));
    expect(html).not.toMatch(/\s(?:xlink:)?href=|url\(|<(?:image|use|foreignObject)\b/);
  });

  // IconSet rule: the circle-alert of the board keeps its circle
  it('CircleAlertIcon draws the circle of the board', () => {
    expect(renderToStaticMarkup(<CircleAlertIcon />)).toMatch(/<circle\b(?=[^>]*\scx="12")(?=[^>]*\scy="12")(?=[^>]*\sr="10")[^>]*>/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20: the circle-minus of the ended state draws the shapes of proposta-voci-elenco.html
  it('CircleMinusIcon draws the circle and the bar of the board', () => {
    const html = renderToStaticMarkup(<CircleMinusIcon />);
    const boardCircle = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z';
    const hasCircle =
      /<circle\b(?=[^>]*\scx="12")(?=[^>]*\scy="12")(?=[^>]*\sr="10")[^>]*>/.test(html) || drawnShapes(html).includes(boardCircle);
    expect(hasCircle, 'circle of radius 10 centred in the box').toBe(true);
    expect(drawnShapes(html).filter((d) => d !== boardCircle)).toEqual(subpathsOf(['M8 12h8']));
  });

  // plan-claude_sessions_client-ui_redesign/REQ-6, IconSet: the SVG is inline and makes no network request
  it.each(icons)('%s references no external resource', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />);
    expect(html).not.toMatch(/\s(?:xlink:)?href=/);
    expect(html).not.toMatch(/url\(/);
    expect(html).not.toMatch(/<(?:image|use|foreignObject)\b/);
  });
});
