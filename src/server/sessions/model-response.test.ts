import { describe, expect, it } from 'vitest';
import { modelResponseOf } from './model-response.js';

const usage = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 };
const assistant = (message: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: 'assistant',
  uuid: 'line-1',
  isSidechain: false,
  ...extra,
  message: { id: 'msg_1', model: 'claude-opus-5-5', role: 'assistant', usage, ...message },
});

describe('modelResponseOf', () => {
  // plan-session_usage/REQ-3: an assistant line with usage gives the response and its four counts
  it('gives key, model, the four token counts and the sidechain mark', () => {
    expect(modelResponseOf(assistant({}))).toEqual({
      key: 'msg_1',
      model: 'claude-opus-5-5',
      input: 10,
      output: 20,
      cacheWrite: 30,
      cacheWrite5m: 30,
      cacheWrite1h: 0,
      cacheRead: 40,
      sidechain: false,
    });
  });

  // modelResponseOf spec: key = message.id, else the line uuid, else no response
  it('uses the line uuid as key when message.id is missing', () => {
    expect(modelResponseOf(assistant({ id: undefined }))?.key).toBe('line-1');
    expect(modelResponseOf(assistant({ id: 42 }))?.key).toBe('line-1');
  });

  it('gives no response without message.id and line uuid', () => {
    expect(modelResponseOf(assistant({ id: undefined }, { uuid: undefined }))).toBeUndefined();
  });

  // modelResponseOf spec: lines that record no response
  it.each([
    ['null', null],
    ['a string', 'assistant'],
    ['a user line', { type: 'user', uuid: 'u', message: { id: 'm', usage } }],
    ['a system line', { type: 'system', uuid: 'u', subtype: 'compact_boundary' }],
    ['an assistant line with no message object', { type: 'assistant', uuid: 'u', message: 'text' }],
    ['an assistant line with no usage', assistant({ usage: undefined })],
    ['an assistant line whose usage is not an object', assistant({ usage: 12 })],
    ['a <synthetic> response', assistant({ model: '<synthetic>' })],
  ])('gives no response for %s', (_name, entry) => {
    expect(modelResponseOf(entry)).toBeUndefined();
  });

  // modelResponseOf spec: model = message.model when a string, else ""
  it('gives an empty model when message.model is not a string', () => {
    expect(modelResponseOf(assistant({ model: undefined }))?.model).toBe('');
    expect(modelResponseOf(assistant({ model: 5 }))?.model).toBe('');
  });

  // modelResponseOf spec: a missing, non-number, non-finite or negative count is 0
  it('counts a missing, non-number, non-finite or negative count as 0', () => {
    const response = modelResponseOf(
      assistant({ usage: { input_tokens: '10', output_tokens: -3, cache_creation_input_tokens: Infinity } }),
    );
    expect(response).toMatchObject({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
    expect(modelResponseOf(assistant({ usage: { input_tokens: Number.NaN } }))?.input).toBe(0);
  });

  // plan-session_usage/REQ-6: a subagent response carries sidechain true; only the boolean true counts
  it('marks sidechain only when isSidechain is true', () => {
    expect(modelResponseOf(assistant({}, { isSidechain: true }))?.sidechain).toBe(true);
    expect(modelResponseOf(assistant({}, { isSidechain: 'true' }))?.sidechain).toBe(false);
    expect(modelResponseOf(assistant({}, { isSidechain: undefined }))?.sidechain).toBe(false);
  });

  // modelResponseOf spec: pure
  it('gives the same result for the same line', () => {
    const entry = assistant({});
    expect(modelResponseOf(entry)).toEqual(modelResponseOf(structuredClone(entry)));
  });
});

describe('modelResponseOf, cache write split', () => {
  const withCreation = (cacheWrite: number, cacheCreation: unknown) =>
    modelResponseOf(assistant({ usage: { ...usage, cache_creation_input_tokens: cacheWrite, cache_creation: cacheCreation } }));
  const splitOf = (response: ReturnType<typeof modelResponseOf>) => [response?.cacheWrite, response?.cacheWrite5m, response?.cacheWrite1h];

  // plan-session_usage/REQ-26: the 5-minute and 1-hour cache write tokens come from usage.cache_creation
  it('takes the split from usage.cache_creation when it matches the cache write', () => {
    expect(splitOf(withCreation(1_000, { ephemeral_5m_input_tokens: 300, ephemeral_1h_input_tokens: 700 }))).toEqual([1_000, 300, 700]);
    expect(splitOf(withCreation(500, { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 500 }))).toEqual([500, 0, 500]);
  });

  // plan-session_usage/REQ-27: no split, or a split that does not match → all 5-minute
  it.each<[string, unknown]>([
    ['no cache_creation', undefined],
    ['cache_creation not an object', 'ephemeral'],
    ['a split that does not add up', { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 }],
    ['a split with only the 1-hour part, too small', { ephemeral_1h_input_tokens: 400 }],
  ])('counts every cache write token as 5-minute with %s', (_, cacheCreation) => {
    expect(splitOf(withCreation(1_000, cacheCreation))).toEqual([1_000, 1_000, 0]);
  });

  // modelResponseOf spec: cacheWrite5m + cacheWrite1h = cacheWrite, always
  it('keeps the two parts equal to the cache write', () => {
    for (const cacheCreation of [undefined, { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 20 }, { ephemeral_5m_input_tokens: 1 }]) {
      const response = withCreation(30, cacheCreation);
      expect(response!.cacheWrite5m! + response!.cacheWrite1h!).toBe(response!.cacheWrite);
    }
  });
});
