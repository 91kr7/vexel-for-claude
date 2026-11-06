import { describe, expect, it } from 'vitest';
import { droppedPathsText } from './dropped-paths-text';

/** The words a POSIX shell reads from `text`: blanks split words, '...' is literal, \x outside quotes is x. */
function shellWords(text: string): string[] {
  const words: string[] = [];
  let word: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === ' ') {
      if (word !== null) words.push(word);
      word = null;
    } else if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0) throw new Error(`unclosed quote in ${text}`);
      word = (word ?? '') + text.slice(i + 1, end);
      i = end;
    } else if (ch === '\\') {
      i += 1;
      word = (word ?? '') + text[i]!;
    } else {
      word = (word ?? '') + ch;
    }
  }
  if (word !== null) words.push(word);
  return words;
}

describe('droppedPathsText', () => {
  // plan-terminal_addons/REQ-48: drop order, one space after each path, the last one included
  it('keeps the drop order and puts one space after each path', () => {
    expect(droppedPathsText(['/a', '/b'])).toBe('/a /b ');
    expect(droppedPathsText(['/b', '/a'])).toBe('/b /a ');
    expect(droppedPathsText(['/home/me/shot.png'])).toBe('/home/me/shot.png ');
  });

  it('gives an empty string for no paths', () => {
    expect(droppedPathsText([])).toBe('');
  });

  // plan-terminal_addons/REQ-49: plain paths are not quoted
  it('leaves a path of plain characters as it is', () => {
    const plain = '/srv/a.b_c-d+e,f:g=h@i%j/0123';
    expect(droppedPathsText([plain])).toBe(`${plain} `);
  });

  // plan-terminal_addons/REQ-49: letters and digits of any script are plain
  it('leaves letters and digits of any script unquoted', () => {
    expect(droppedPathsText(['/home/me/città/日本語/Ωmega٣'])).toBe('/home/me/città/日本語/Ωmega٣ ');
  });

  // plan-terminal_addons/REQ-49, scenario "The user drops files on the terminal in the desktop app"
  it('wraps a path with a space in single quotes', () => {
    expect(droppedPathsText(['/home/me/shot.png', '/home/me/My Docs'])).toBe("/home/me/shot.png '/home/me/My Docs' ");
  });

  // plan-terminal_addons/REQ-49: a single quote inside a quoted path is written as '\''
  it("writes a single quote as '\\'' inside the quotes", () => {
    expect(droppedPathsText(["/tmp/it's"])).toBe("'/tmp/it'\\''s' ");
  });

  // plan-terminal_addons/REQ-49: shell-special characters
  it.each(['"', '$', '&', '(', ')', '*', '\\', '~', '!', ';', '|', '<', '>', '?', '[', '#', '`', '{', '\t'])(
    'quotes a path that contains %j',
    (special) => {
      const path = `/tmp/a${special}b`;
      expect(droppedPathsText([path])).toBe(`'${path}' `);
    },
  );

  it('quotes a path that starts with ~', () => {
    expect(droppedPathsText(['~/notes'])).toBe("'~/notes' ");
  });

  // droppedPathsText rule: a shell reads each path back as one word, equal to the path
  it('gives text that a shell reads back as the same paths, one word each', () => {
    const paths = ['/home/me/shot.png', '/home/me/My Docs', "/tmp/it's", '/tmp/$HOME & (x)*', '/tmp/back\\slash "q"', '~/t!lde', '/srv/città'];
    expect(shellWords(droppedPathsText(paths))).toEqual(paths);
  });
});
