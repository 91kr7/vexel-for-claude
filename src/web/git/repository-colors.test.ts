/// <reference types="node" />
// Unit tests of repositoryColor and its theme tokens (plan-multi_repo_workspace, batch repo-detection).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_COLOR_TOKENS, repositoryColor } from './repository-colors';

// Vitest gives CSS imports no content, so the test reads the file.
const css = readFileSync(new URL('../theme/tokens.css', import.meta.url), 'utf8');
const TOKENS = ['--repo-color-1', '--repo-color-2', '--repo-color-3', '--repo-color-4', '--repo-color-5', '--repo-color-6'];

/** The declarations of the first rule whose selector matches. */
function block(selector: RegExp): string {
  const match = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, `a rule ${selector}`).not.toBeNull();
  return match![1]!;
}
const valueOf = (declarations: string, token: string) => new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(declarations)?.[1]?.trim();

describe('repositoryColor', () => {
  it('has a palette of 6 theme tokens', () => {
    expect([...REPOSITORY_COLOR_TOKENS]).toEqual(TOKENS);
  });

  // plan-multi_repo_workspace/REQ-7: colour by position in the list, starting again after the last one
  it.each([
    [0, 'var(--repo-color-1)'],
    [1, 'var(--repo-color-2)'],
    [5, 'var(--repo-color-6)'],
    [6, 'var(--repo-color-1)'],
    [7, 'var(--repo-color-2)'],
    [13, 'var(--repo-color-2)'],
  ])('gives position %i the colour %s', (index, colour) => {
    expect(repositoryColor(index)).toBe(colour);
  });

  it('gives neighbours different colours', () => {
    for (let i = 0; i < 12; i += 1) expect(repositoryColor(i)).not.toBe(repositoryColor(i + 1));
  });
});

describe('repository colour tokens', () => {
  // spec repositoryColor: each token has a dark value and a light value
  it.each([
    ['dark', /:root(?!\[)/],
    ['light', /:root\[data-theme='light'\]/],
  ])('defines 6 different values in the %s theme', (_name, selector) => {
    const declarations = block(selector);
    const values = TOKENS.map((token) => valueOf(declarations, token));
    expect(values.every((v) => v !== undefined && v.length > 0), values.join(', ')).toBe(true);
    expect(new Set(values).size).toBe(6);
  });

  it('gives each token a light value other than its dark value', () => {
    const dark = block(/:root(?!\[)/);
    const light = block(/:root\[data-theme='light'\]/);
    for (const token of TOKENS) expect(valueOf(light, token), token).not.toBe(valueOf(dark, token));
  });
});
