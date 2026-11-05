import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const REFRESH_MS = 30_000;

const twoDigits = (value: number) => String(value).padStart(2, '0');

export function formatRelativeTime(iso: string, now: Date): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return '';
  const elapsed = now.getTime() - time.getTime();
  if (elapsed < MINUTE_MS) return 'ora';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min fa`;
  if (time.toDateString() === now.toDateString()) return `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
  return `${twoDigits(time.getDate())}/${twoDigits(time.getMonth() + 1)}/${time.getFullYear()}`;
}

interface RelativeTimeProps {
  iso: string;
  className?: string;
}

export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className={className} dateTime={iso}>
      {formatRelativeTime(iso, new Date())}
    </time>
  );
}
