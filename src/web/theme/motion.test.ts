// Tests of plan-ui_transitions, batch modal-dialogs: MotionTokens spec, read from the style sheets.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webDir = fileURLToPath(new URL('..', import.meta.url));
const read = (relative: string) => readFileSync(path.join(webDir, relative), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

/** Each `--motion-*` declaration with the selector or at-rule chain around it. */
function motionDeclarations(css: string): { name: string; value: string; context: string[] }[] {
  const found: { name: string; value: string; context: string[] }[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const char of stripComments(css)) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      collect(buffer);
      stack.pop();
      buffer = '';
    } else if (char === ';') {
      collect(buffer);
      buffer = '';
    } else buffer += char;
  }
  function collect(text: string) {
    const match = text.trim().match(/^(--motion-[\w-]+)\s*:\s*(.+)$/);
    if (match?.[1] && match[2]) found.push({ name: match[1], value: match[2].trim(), context: [...stack] });
  }
  return found;
}

/** The start and end slopes of a `cubic-bezier(x1, y1, x2, y2)` timing function. */
function bezier(value: string | undefined): { startSlope: number; endSlope: number } {
  const match = value?.match(/^cubic-bezier\(\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/);
  expect(match, `a cubic-bezier curve: ${value}`).toBeTruthy();
  const [x1, y1, x2, y2] = match!.slice(1).map(Number) as [number, number, number, number];
  const slope = (dy: number, dx: number) => (dx === 0 ? Number.POSITIVE_INFINITY : dy / dx);
  // A control point on its end point leaves the tangent to the other control point.
  const start = x1 === 0 && y1 === 0 ? slope(y2, x2) : slope(y1, x1);
  const end = x2 === 1 && y2 === 1 ? slope(1 - y1, 1 - x1) : slope(1 - y2, 1 - x2);
  return { startSlope: start, endSlope: end };
}

const toMs = (value: string) => (value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000);

describe('MotionTokens', () => {
  const tokens = motionDeclarations(read('theme/motion.css'));
  const valueOf = (name: string) => tokens.find((token) => token.name === name)?.value;

  // MotionTokens "Contract": the durations of the tokens
  it('sets 300ms enter, 200ms exit and 600ms cascade', () => {
    expect(valueOf('--motion-duration-enter')).toBe('300ms');
    expect(valueOf('--motion-duration-exit')).toBe('200ms');
    expect(valueOf('--motion-cascade-max')).toBe('600ms');
  });

  // plan-ui_transitions/REQ-31: every effect at most 300ms, a cascade within 600ms
  it('keeps every effect within 300ms and the cascade within 600ms', () => {
    for (const token of tokens.filter((t) => t.name.startsWith('--motion-duration-'))) expect(toMs(token.value), token.name).toBeLessThanOrEqual(300);
    expect(toMs(valueOf('--motion-cascade-max') ?? 'NaN')).toBeLessThanOrEqual(600);
  });

  // MotionTokens "Contract": the enter curve starts with no jump and slows down; the exit curve starts slowly and speeds up
  it('sets a soft enter deceleration and a soft exit acceleration', () => {
    const enter = bezier(valueOf('--motion-ease-enter'));
    const exit = bezier(valueOf('--motion-ease-exit'));
    expect(enter.startSlope, 'enter: no jump in the first frames').toBeLessThanOrEqual(2);
    expect(enter.endSlope, 'enter: slows down at the end').toBeLessThan(1);
    expect(exit.startSlope, 'exit: starts slowly').toBeLessThan(1);
    expect(exit.endSlope, 'exit: speeds up at the end').toBeGreaterThan(1);
  });

  // plan-ui_transitions/REQ-32: the tokens sit on :root only, in no theme or look selector
  it('declares the tokens on :root only', () => {
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(token.context, token.name).toEqual([':root']);
  });

  // plan-ui_transitions/REQ-32: no theme or look file sets a motion token; elsewhere only the reduced-motion rule does
  it('is overridden by no theme or look, only by the reduced-motion rule', () => {
    const motionFile = path.join(webDir, 'theme', 'motion.css');
    for (const file of cssFiles(webDir).filter((f) => f !== motionFile)) {
      for (const token of motionDeclarations(readFileSync(file, 'utf8'))) {
        const where = `${path.relative(webDir, file)} ${token.context.join(' > ')} ${token.name}`;
        expect(token.context[0], where).toMatch(/^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/);
        expect(token.context.slice(1), where).toEqual([':root']);
      }
    }
  });

  // plan-ui_transitions/REQ-25: with reduced motion the three durations are 0ms
  it('sets the three durations to 0ms under reduced motion', () => {
    const reduced = motionDeclarations(read('styles.css')).filter((token) => /prefers-reduced-motion\s*:\s*reduce/.test(token.context[0] ?? ''));
    const byName = Object.fromEntries(reduced.map((token) => [token.name, toMs(token.value)]));
    expect(byName).toMatchObject({ '--motion-duration-enter': 0, '--motion-duration-exit': 0, '--motion-cascade-max': 0 });
  });
});
