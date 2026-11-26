import { useEffect, useState } from 'react';
import { shortDuration } from './short-duration';

const TICK_MS = 1000;

type TickListener = (now: number) => void;

const tickListeners = new Set<TickListener>();
let ticker: ReturnType<typeof setInterval> | undefined;

function onTick(listener: TickListener): () => void {
  tickListeners.add(listener);
  ticker ??= setInterval(() => {
    const now = Date.now();
    for (const each of tickListeners) each(now);
  }, TICK_MS);
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size > 0) return;
    clearInterval(ticker);
    ticker = undefined;
  };
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => onTick(setNow), []);
  return now;
}

interface ElapsedTimeProps {
  since: string;
  className?: string;
}

export function ElapsedTime({ since, className }: ElapsedTimeProps) {
  const now = useNow();
  const start = Date.parse(since);
  if (Number.isNaN(start)) return null;
  return (
    <time className={className} dateTime={since}>
      {shortDuration(now - start)}
    </time>
  );
}
