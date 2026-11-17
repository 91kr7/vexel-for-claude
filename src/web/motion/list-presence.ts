import { useEffect, useState } from 'react';
import { motionDurationMs } from './ExitPresence';

export type PresencePhase = 'shown' | 'entering' | 'leaving';

export interface PresentItem<T> {
  key: string;
  item: T;
  phase: PresencePhase;
}

interface TimedItem<T> extends PresentItem<T> {
  until: number;
}

interface Presence<T> {
  source: readonly T[] | undefined;
  entries: readonly TimedItem<T>[];
}

function nextEntries<T>(previous: readonly TimedItem<T>[], items: readonly T[], keyOf: (item: T) => string, appeared: boolean): TimedItem<T>[] {
  const now = Date.now();
  const enterMs = appeared ? motionDurationMs('--motion-duration-enter') : 0;
  const exitMs = motionDurationMs('--motion-duration-exit');
  const before = new Map(previous.map((entry) => [entry.key, entry]));
  const entries: TimedItem<T>[] = items.map((item) => {
    const key = keyOf(item);
    const old = before.get(key);
    if (old && old.phase !== 'leaving') return { ...old, item };
    return enterMs > 0 ? { key, item, phase: 'entering', until: now + enterMs } : { key, item, phase: 'shown', until: 0 };
  });
  const present = new Set(entries.map((entry) => entry.key));
  previous.forEach((old, index) => {
    if (present.has(old.key)) return;
    if (old.phase === 'leaving') entries.splice(Math.min(index, entries.length), 0, old);
    else if (exitMs > 0) entries.splice(Math.min(index, entries.length), 0, { ...old, phase: 'leaving', until: now + exitMs });
  });
  return entries;
}

// The items of a list, plus the removed ones while they play their exit; items added after the first appearance enter.
export function useListPresence<T>(items: readonly T[] | undefined, keyOf: (item: T) => string): readonly PresentItem<T>[] {
  const [presence, setPresence] = useState<Presence<T>>(() => ({
    source: items,
    entries: items ? nextEntries([], items, keyOf, false) : [],
  }));

  let current = presence;
  if (presence.source !== items) {
    current = {
      source: items,
      entries: items ? nextEntries(presence.entries, items, keyOf, presence.source !== undefined) : [],
    };
    setPresence(current);
  }

  useEffect(() => {
    const timed = current.entries.filter((entry) => entry.phase !== 'shown');
    if (timed.length === 0) return;
    const firstEnd = Math.min(...timed.map((entry) => entry.until));
    const timer = setTimeout(() => {
      const now = Date.now();
      setPresence((state) => ({
        source: state.source,
        entries: state.entries.flatMap((entry) => {
          if (entry.phase === 'shown' || entry.until > now) return [entry];
          return entry.phase === 'leaving' ? [] : [{ ...entry, phase: 'shown' as const, until: 0 }];
        }),
      }));
    }, Math.max(0, firstEnd - Date.now()));
    return () => clearTimeout(timer);
  }, [current.entries]);

  return current.entries;
}
