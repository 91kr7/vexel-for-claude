import { describe, expect, it } from 'vitest';
import { planLimitsOf } from './plan-limits-rule.js';

const RESET = '2026-11-14T18:30:00+01:00';

describe('planLimitsOf', () => {
  // plan-usage_limits/REQ-5, REQ-6, REQ-7: rows of `limits`, in the given order, with the labels of /usage
  it('lists the rows of limits in order with the labels of /usage', () => {
    const limits = planLimitsOf({
      limits: [
        { kind: 'weekly_scoped', percent: 12, resets_at: RESET, scope: { model: { display_name: 'Opus' } } },
        { kind: 'session', percent: 40, resets_at: RESET },
        { kind: 'weekly_all', percent: 75, resets_at: RESET },
      ],
    });
    expect(limits).toEqual([
      { label: 'Current week (Opus)', percent: 12, resetsAt: RESET },
      { label: 'Current session', percent: 40, resetsAt: RESET },
      { label: 'Current week (all models)', percent: 75, resetsAt: RESET },
    ]);
  });

  // plan-usage_limits/REQ-7 and the gatekeeper decision: every model row shows, 0% included
  it('lists a model row at 0%', () => {
    const limits = planLimitsOf({
      limits: [{ kind: 'weekly_scoped', percent: 0, resets_at: RESET, scope: { model: { display_name: 'Sonnet' } } }],
    });
    expect(limits).toEqual([{ label: 'Current week (Sonnet)', percent: 0, resetsAt: RESET }]);
  });

  // spec: percent is a whole number, rounded to the nearest
  it.each([
    [74.4, 74],
    [74.5, 75],
    [92.6, 93],
  ])('rounds %s to %s', (percent, rounded) => {
    expect(planLimitsOf({ limits: [{ kind: 'session', percent, resets_at: RESET }] })[0]?.percent).toBe(rounded);
  });

  // spec: resetsAt is null when the answer gives none
  it('gives a null reset time when resets_at is missing', () => {
    expect(planLimitsOf({ limits: [{ kind: 'session', percent: 3 }] })).toEqual([{ label: 'Current session', percent: 3, resetsAt: null }]);
  });

  // spec: rows of another kind, without a model name, with a bad percent or not an object give nothing
  it('skips rows that are not limits', () => {
    const limits = planLimitsOf({
      limits: [
        { kind: 'other', percent: 10, resets_at: RESET },
        { kind: 'weekly_scoped', percent: 10, resets_at: RESET },
        { kind: 'weekly_scoped', percent: 10, resets_at: RESET, scope: { model: { display_name: '' } } },
        { kind: 'weekly_scoped', percent: 10, resets_at: RESET, scope: { model: { display_name: 7 } } },
        { kind: 'session', percent: '10', resets_at: RESET },
        { kind: 'session', percent: Number.NaN, resets_at: RESET },
        { kind: 'session', percent: Number.POSITIVE_INFINITY, resets_at: RESET },
        'session',
        null,
        42,
        { kind: 'weekly_all', percent: 20, resets_at: RESET },
      ],
    });
    expect(limits).toEqual([{ label: 'Current week (all models)', percent: 20, resetsAt: RESET }]);
  });

  // spec: with a non-empty limits array the keys are not read
  it('ignores the fallback keys when limits has a valid row', () => {
    const limits = planLimitsOf({
      limits: [{ kind: 'session', percent: 1, resets_at: RESET }],
      five_hour: { utilization: 90, resets_at: RESET },
    });
    expect(limits).toEqual([{ label: 'Current session', percent: 1, resetsAt: RESET }]);
  });

  // spec: no limits array, an empty one, or one with no limit -> fallback keys in order
  it.each<[string, Record<string, unknown>]>([
    ['missing', {}],
    ['empty', { limits: [] }],
    ['without any limit', { limits: [{ kind: 'other', percent: 5 }] }],
    ['not an array', { limits: 'x' }],
  ])('falls back to the keys when limits is %s', (_name, extra) => {
    const limits = planLimitsOf({
      ...extra,
      seven_day_sonnet: { utilization: 5, resets_at: RESET },
      five_hour: { utilization: 41.6, resets_at: RESET },
      seven_day_opus: { utilization: 0, resets_at: null },
      seven_day: { utilization: 60, resets_at: RESET },
    });
    expect(limits).toEqual([
      { label: 'Current session', percent: 42, resetsAt: RESET },
      { label: 'Current week (all models)', percent: 60, resetsAt: RESET },
      { label: 'Current week (Opus)', percent: 0, resetsAt: null },
      { label: 'Current week (Sonnet)', percent: 5, resetsAt: RESET },
    ]);
  });

  // spec: a key that is null, missing or without a finite utilization gives nothing; no other seven_day_* key is read
  it('skips fallback keys without a finite utilization and never reads non-model keys', () => {
    const limits = planLimitsOf({
      five_hour: null,
      seven_day: { utilization: null, resets_at: RESET },
      seven_day_opus: { utilization: 'x', resets_at: RESET },
      seven_day_sonnet: { utilization: 9, resets_at: RESET },
      seven_day_oauth_apps: { utilization: 50, resets_at: RESET },
      seven_day_cowork: { utilization: 50, resets_at: RESET },
      seven_day_omelette: { utilization: 50, resets_at: RESET },
    });
    expect(limits).toEqual([{ label: 'Current week (Sonnet)', percent: 9, resetsAt: RESET }]);
  });

  // spec: a body that is not an object gives []
  it.each([null, undefined, 'text', 5, []])('gives no limit for the body %j', (body) => {
    expect(planLimitsOf(body)).toEqual([]);
  });
});
