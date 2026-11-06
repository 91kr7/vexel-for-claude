import { describe, expect, it } from 'vitest';
import { contextWindowOf } from './context-window.js';

describe('contextWindowOf', () => {
  // plan-session_usage/REQ-4: a model that is not extended has a 200,000 window
  it.each(['claude-haiku-5-5', 'claude-opus-4-1', 'gpt-whatever', ''])('gives 200,000 for %j', (model) => {
    expect(contextWindowOf(model, 45_200)).toBe(200_000);
  });

  // plan-session_usage/REQ-4: the known extended models, with or without a date suffix
  it.each(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5-20261015', 'claude-sonnet-5-5-20260901'])(
    'gives 1,000,000 for the extended model %s',
    (model) => {
      expect(contextWindowOf(model, 1_000)).toBe(1_000_000);
    },
  );

  // plan-session_usage/REQ-4, requirements "Window size": the "[1m]" marker, in any letter case
  it.each(['claude-haiku-5-5[1m]', 'some-model[1M]'])('gives 1,000,000 for %s', (model) => {
    expect(contextWindowOf(model, 150_000)).toBe(1_000_000);
  });

  // plan-session_usage/REQ-5: above 200,000 used tokens the window is 1,000,000, at 200,000 it is not
  it('gives 1,000,000 above 200,000 used tokens for any model', () => {
    expect(contextWindowOf('claude-haiku-5-5', 200_001)).toBe(1_000_000);
    expect(contextWindowOf('', 300_000)).toBe(1_000_000);
    expect(contextWindowOf('claude-haiku-5-5', 200_000)).toBe(200_000);
  });
});
