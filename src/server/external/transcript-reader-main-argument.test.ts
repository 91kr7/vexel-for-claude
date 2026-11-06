import { describe, expect, it } from 'vitest';
import { itemsOf, mainArgumentOf } from './transcript-reader.js';

const summaryOf = (input: unknown): string | undefined => {
  const block = input === undefined ? { type: 'tool_use', name: 'Tool' } : { type: 'tool_use', name: 'Tool', input };
  const [item] = itemsOf({ type: 'assistant', message: { role: 'assistant', content: [block] } });
  return item?.kind === 'tool_call' ? item.summary : undefined;
};

describe('mainArgumentOf', () => {
  // TranscriptReader "Main argument": the first string among the known keys, in their order
  it('takes the first string among command, file_path, path, pattern, url, query, description, prompt', () => {
    const keys = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt'];
    for (let i = 0; i < keys.length; i += 1) {
      const input = Object.fromEntries([['other', 'first value'], ...keys.slice(i).reverse().map((key) => [key, `value of ${key}`])]);
      expect(mainArgumentOf(input), keys[i]).toBe(`value of ${keys[i]}`);
    }
  });

  // TranscriptReader "Main argument": a known key that is not a string is skipped
  it('skips a known key whose value is not a string', () => {
    expect(mainArgumentOf({ command: 3, file_path: '/a.ts' })).toBe('/a.ts');
  });

  // TranscriptReader "Main argument": else the first string value of the input, arrays included
  it('falls back to the first string value of an object or an array', () => {
    expect(mainArgumentOf({ count: 2, target: 'staging', mode: 'fast' })).toBe('staging');
    expect(mainArgumentOf([1, 'second', 'third'])).toBe('second');
  });

  // TranscriptReader "Main argument": no string, or an input that is not an object → none
  it('gives undefined when there is no main argument', () => {
    for (const input of [undefined, null, 'npm test', 42, true, {}, { count: 2, nested: { command: 'x' } }, []]) {
      expect(mainArgumentOf(input), JSON.stringify(input)).toBeUndefined();
    }
  });

  // TranscriptReader mainArgumentOf contract: the text as it is, no trim, no cut
  it('returns the text as it is, with no trim and no cut', () => {
    const command = `  npm ci\n  npm test  ${'x'.repeat(200)}\n`;
    expect(mainArgumentOf({ command })).toBe(command);
  });

  // TranscriptReader "Tool call summary": unchanged, the main argument with the JSON fallback
  it('leaves the card summary unchanged', () => {
    expect(summaryOf({ command: '  npm   ci\n npm test ' })).toBe('npm ci npm test');
    expect(summaryOf({ count: 2 })).toBe('{"count":2}');
    expect(summaryOf(undefined)).toBe('');
    expect(summaryOf({ command: 'y'.repeat(130) })).toBe(`${'y'.repeat(120)}…`);
  });
});
