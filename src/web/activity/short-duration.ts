const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_MIN = 60;

export function shortDuration(ms: number): string {
  const seconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / SECOND_MS) : 0;
  if (seconds < MINUTE_S) return `${seconds} s`;
  const minutes = Math.floor(seconds / MINUTE_S);
  if (minutes < HOUR_MIN) return `${minutes} min`;
  return `${Math.floor(minutes / HOUR_MIN)} h ${String(minutes % HOUR_MIN).padStart(2, '0')} min`;
}
