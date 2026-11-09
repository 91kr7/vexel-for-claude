const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isValidResetTime(resetsAt: string): boolean {
  return !Number.isNaN(Date.parse(resetsAt));
}

export function remainingText(resetsAt: string, nowMs: number): string {
  const remaining = Date.parse(resetsAt) - nowMs;
  if (!(remaining >= MINUTE_MS)) return '<1m';
  if (remaining >= DAY_MS) return `${Math.floor(remaining / DAY_MS)}d ${Math.floor((remaining % DAY_MS) / HOUR_MS)}h`;
  if (remaining >= HOUR_MS) return `${Math.floor(remaining / HOUR_MS)}h ${Math.floor((remaining % HOUR_MS) / MINUTE_MS)}m`;
  return `${Math.floor(remaining / MINUTE_MS)}m`;
}

export function resetDateText(resetsAt: string): string {
  const date = new Date(resetsAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

export function lastReadText(readAtMs: number): string {
  const date = new Date(readAtMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
