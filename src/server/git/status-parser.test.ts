// Unit tests of parseStatus (plan-git_explorer, batch uncommitted-changes). Records follow the porcelain v2 format of git-status(1).
import { describe, expect, it } from 'vitest';
import { parseStatus } from './status-parser.js';

const H = '0123456789abcdef0123456789abcdef01234567';
const ordinary = (xy: string, file: string) => `1 ${xy} N... 100644 100644 100644 ${H} ${H} ${file}`;
const rename = (xy: string, score: string, file: string, oldFile: string) => `2 ${xy} N... 100644 100644 100644 ${H} ${H} ${score} ${file}\0${oldFile}`;
const unmerged = (xy: string, file: string) => `u ${xy} N... 100644 100644 100644 100644 ${H} ${H} ${H} ${file}`;
const output = (...records: string[]) => records.map((record) => `${record}\0`).join('');

describe('parseStatus', () => {
  it('gives no entry for an empty output', () => {
    expect(parseStatus('')).toEqual([]);
  });

  // plan-git_explorer/REQ-10, REQ-11
  it.each([
    ['A.', 'added'],
    ['M.', 'modified'],
    ['T.', 'modified'],
    ['D.', 'deleted'],
  ])('maps the staged letter of %s to %s', (xy, kind) => {
    expect(parseStatus(output(ordinary(xy, 'a.txt')))).toEqual([{ group: 'staged', kind, path: 'a.txt' }]);
  });

  it.each([
    ['.M', 'modified'],
    ['.T', 'modified'],
    ['.D', 'deleted'],
  ])('maps the worktree letter of %s to %s in unstaged', (xy, kind) => {
    expect(parseStatus(output(ordinary(xy, 'a.txt')))).toEqual([{ group: 'unstaged', kind, path: 'a.txt' }]);
  });

  // plan-git_explorer/REQ-11: a file with both changes is in both groups
  it('gives one staged and one unstaged entry for a file changed on both sides', () => {
    expect(parseStatus(output(ordinary('AM', 'both.txt')))).toEqual([
      { group: 'staged', kind: 'added', path: 'both.txt' },
      { group: 'unstaged', kind: 'modified', path: 'both.txt' },
    ]);
  });

  it('gives a staged rename with its old path', () => {
    expect(parseStatus(output(rename('R.', 'R100', 'new/name.txt', 'old/name.txt')))).toEqual([
      { group: 'staged', kind: 'renamed', path: 'new/name.txt', oldPath: 'old/name.txt' },
    ]);
  });

  it('gives a rename with a worktree change as renamed in staged and modified in unstaged', () => {
    expect(parseStatus(output(rename('RM', 'R87', 'b.txt', 'a.txt')))).toEqual([
      { group: 'staged', kind: 'renamed', path: 'b.txt', oldPath: 'a.txt' },
      { group: 'unstaged', kind: 'modified', path: 'b.txt' },
    ]);
  });

  it('gives a copy as added with no old path', () => {
    expect(parseStatus(output(rename('C.', 'C100', 'copy.txt', 'source.txt')))).toEqual([{ group: 'staged', kind: 'added', path: 'copy.txt' }]);
  });

  // plan-git_explorer/REQ-10, REQ-11: untracked files go in the unstaged group
  it('gives an untracked record as unstaged untracked', () => {
    expect(parseStatus(output('? notes/todo.md'))).toEqual([{ group: 'unstaged', kind: 'untracked', path: 'notes/todo.md' }]);
  });

  it('gives an unmerged record as one unstaged modified entry', () => {
    expect(parseStatus(output(unmerged('UU', 'conflict.txt')))).toEqual([{ group: 'unstaged', kind: 'modified', path: 'conflict.txt' }]);
  });

  it('skips header and ignored records', () => {
    const text = output('# branch.oid ' + H, '# branch.head main', '! build/out.js', ordinary('.M', 'a.txt'));
    expect(parseStatus(text)).toEqual([{ group: 'unstaged', kind: 'modified', path: 'a.txt' }]);
  });

  it('keeps paths with spaces whole, in every record kind', () => {
    const text = output(ordinary('M.', 'dir one/file a.txt'), rename('R.', 'R100', 'new name.txt', 'old name.txt'), '? my notes.md');
    expect(parseStatus(text)).toEqual([
      { group: 'staged', kind: 'modified', path: 'dir one/file a.txt' },
      { group: 'staged', kind: 'renamed', path: 'new name.txt', oldPath: 'old name.txt' },
      { group: 'unstaged', kind: 'untracked', path: 'my notes.md' },
    ]);
  });

  it('keeps the order of the output across record kinds', () => {
    const text = output('? z.txt', rename('R.', 'R100', 'b.txt', 'a.txt'), ordinary('.D', 'c.txt'), ordinary('A.', 'd.txt'));
    expect(parseStatus(text).map((entry) => entry.path)).toEqual(['z.txt', 'b.txt', 'c.txt', 'd.txt']);
  });
});
