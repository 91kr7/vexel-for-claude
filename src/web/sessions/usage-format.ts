import type { ContextOccupancy } from './live-session-store';

export type UsageLevel = 'normal' | 'warning' | 'error';

const WARNING_PERCENT = 70;
const ERROR_PERCENT = 90;
const ONE_CENT = 0.01;

export const INCOMPLETE_COST_TEXT = 'Incomplete: the price of a model is unknown';

export function shortTokens(count: number): string {
  if (count < 1000) return String(Math.round(count));
  const thousandTenths = Math.round(count / 100);
  if (thousandTenths < 10_000) return `${thousandTenths / 10}k`;
  return `${Math.round(count / 100_000) / 10}M`;
}

export function percentOf({ used, window }: ContextOccupancy): number {
  return Math.round((used / window) * 100);
}

export function usageLevelOf(percent: number): UsageLevel {
  if (percent >= ERROR_PERCENT) return 'error';
  if (percent >= WARNING_PERCENT) return 'warning';
  return 'normal';
}

export function costText(usd: number | undefined): string {
  if (usd === undefined) return '—';
  if (usd < ONE_CENT) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}
