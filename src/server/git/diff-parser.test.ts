// Unit tests of parseDiff (plan-git_explorer, batch uncommitted-changes).
import { describe, expect, it } from 'vitest';
import { parseDiff } from './diff-parser.js';

const header = ['diff --git a/a.txt b/a.txt', 'index 1111111..2222222 100644', '--- a/a.txt', '+++ b/a.txt'];

/** A diff of one hunk with `count` added lines. */
function bigDiff(count: number): string {
  const body = Array.from({ length: count - 1 }, (_, i) => `+line ${i + 1}`);
  return [...header, `@@ -0,0 +1,${count - 1} @@`, ...body, ''].join('\n');
}

describe('parseDiff', () => {
  it('gives an empty, not binary, not cut diff for an empty output', () => {
    expect(parseDiff('')).toEqual({ binary: false, cut: false, lines: [] });
  });

  // plan-git_explorer/REQ-12: added, removed, context and hunk lines are told apart
  it('marks hunk, context, removed and added lines, and drops the file headers', () => {
    const text = [...header, '@@ -1,3 +1,3 @@ section', ' keep', '-old', '+new', ' end', ''].join('\n');
    expect(parseDiff(text)).toEqual({
      binary: false,
      cut: false,
      lines: [
        { kind: 'hunk', text: '@@ -1,3 +1,3 @@ section' },
        { kind: 'context', text: 'keep' },
        { kind: 'removed', text: 'old' },
        { kind: 'added', text: 'new' },
        { kind: 'context', text: 'end' },
      ],
    });
  });

  it('keeps the text of a line that starts like a header after its marker', () => {
    const text = [...header, '@@ -1 +1 @@', '--- not a header', '+++ not a header', ''].join('\n');
    expect(parseDiff(text).lines).toEqual([
      { kind: 'hunk', text: '@@ -1 +1 @@' },
      { kind: 'removed', text: '-- not a header' },
      { kind: 'added', text: '++ not a header' },
    ]);
  });

  it('gives no line for mode, rename and similarity headers', () => {
    const text = [
      'diff --git a/old.txt b/new.txt',
      'old mode 100644',
      'new mode 100755',
      'similarity index 90%',
      'rename from old.txt',
      'rename to new.txt',
      'index 1111111..2222222',
      '--- a/old.txt',
      '+++ b/new.txt',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      '',
    ].join('\n');
    expect(parseDiff(text).lines.map((line) => line.kind)).toEqual(['hunk', 'removed', 'added']);
  });

  it('gives no line for a pure rename', () => {
    const text = ['diff --git a/old.txt b/new.txt', 'similarity index 100%', 'rename from old.txt', 'rename to new.txt', ''].join('\n');
    expect(parseDiff(text)).toEqual({ binary: false, cut: false, lines: [] });
  });

  it('gives no line for "\\ No newline at end of file"', () => {
    const text = [...header, '@@ -1 +1 @@', '-a', '\\ No newline at end of file', '+b', '\\ No newline at end of file', ''].join('\n');
    expect(parseDiff(text).lines).toEqual([
      { kind: 'hunk', text: '@@ -1 +1 @@' },
      { kind: 'removed', text: 'a' },
      { kind: 'added', text: 'b' },
    ]);
  });

  // plan-git_explorer/REQ-14
  it('marks "Binary files … differ" as binary with no lines', () => {
    const text = ['diff --git a/img.png b/img.png', 'index 1111111..2222222 100644', 'Binary files a/img.png and b/img.png differ', ''].join('\n');
    expect(parseDiff(text)).toEqual({ binary: true, cut: false, lines: [] });
  });

  it('marks a binary patch as binary with no lines', () => {
    const text = ['diff --git a/img.png b/img.png', 'index 1111111..2222222 100644', 'GIT binary patch', 'literal 4', 'LcmZQzWMT#Y01f~L', '', 'literal 0', 'HcmV?d00001', ''].join('\n');
    expect(parseDiff(text)).toEqual({ binary: true, cut: false, lines: [] });
  });

  // plan-git_explorer/REQ-15
  it('does not cut a diff of exactly 5,000 lines', () => {
    const diff = parseDiff(bigDiff(5_000));
    expect(diff.cut).toBe(false);
    expect(diff.lines).toHaveLength(5_000);
  });

  it('cuts a diff of 5,001 lines to its first 5,000', () => {
    const diff = parseDiff(bigDiff(5_001));
    expect(diff.cut).toBe(true);
    expect(diff.lines).toHaveLength(5_000);
    expect(diff.lines[0]).toEqual({ kind: 'hunk', text: '@@ -0,0 +1,5000 @@' });
    expect(diff.lines[4_999]).toEqual({ kind: 'added', text: 'line 4999' });
  });

  it('cuts a diff of 20,000 lines to its first 5,000', () => {
    const diff = parseDiff(bigDiff(20_000));
    expect(diff.cut).toBe(true);
    expect(diff.lines).toHaveLength(5_000);
  });

  it('marks a truncated output as cut and drops its last partial line', () => {
    const text = [...header, '@@ -0,0 +1,3 @@', '+one', '+two', '+thr'].join('\n');
    expect(parseDiff(text, true)).toEqual({
      binary: false,
      cut: true,
      lines: [
        { kind: 'hunk', text: '@@ -0,0 +1,3 @@' },
        { kind: 'added', text: 'one' },
        { kind: 'added', text: 'two' },
      ],
    });
  });
});
