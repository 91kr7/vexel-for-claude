const MAX_LENGTH = 100;
const FENCE = /^\s*(```|~~~)/;
const HEADING_MARK = /^\s*#{1,6}\s+/;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+/;
const INLINE_CODE = /`+([^`]+)`+/g;
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const STRONG = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g;
const STAR_EMPHASIS = /\*(?=\S)(.+?)(?<=\S)\*/g;
const UNDERSCORE_EMPHASIS = /(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g;
const STRIKETHROUGH = /~~(?=\S)(.+?)(?<=\S)~~/g;

function plainText(text: string): string {
  return text
    .replace(LINK, '$1')
    .replace(STRONG, '$2')
    .replace(STAR_EMPHASIS, '$1')
    .replace(UNDERSCORE_EMPHASIS, '$1')
    .replace(STRIKETHROUGH, '$1');
}

function plainLine(line: string): string {
  const body = line.replace(HEADING_MARK, '').replace(LIST_MARK, '');
  let result = '';
  let rest = 0;
  for (const code of body.matchAll(INLINE_CODE)) {
    result += plainText(body.slice(rest, code.index)) + code[1];
    rest = code.index + code[0].length;
  }
  return result + plainText(body.slice(rest));
}

export function plainExcerpt(markdown: string): string {
  const lines: string[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    else lines.push(inFence ? line : plainLine(line));
  }
  const text = Array.from(lines.join(' ').replace(/\s+/g, ' ').trim());
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).join('')}…` : text.join('');
}
