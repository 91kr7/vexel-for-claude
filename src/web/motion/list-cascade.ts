import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { motionDurationMs } from './ExitPresence';

export const CASCADE_STEP_MS = 40;

export interface CascadeItem {
  className: 'cascade-item';
  style: CSSProperties;
}

// Enter delay of each item, so the last one ends its enter effect within `cascadeMaxMs`.
export function cascadeDelaysMs(count: number, cascadeMaxMs: number, enterMs: number): number[] {
  const room = Math.max(0, cascadeMaxMs - enterMs);
  const step = count > 1 ? Math.min(CASCADE_STEP_MS, room / (count - 1)) : 0;
  return Array.from({ length: count }, (_, index) => Math.round(index * step));
}

interface Cascade {
  delays: ReadonlyMap<string, number>;
  endsAfterMs: number;
}

export function useListCascade(keys: readonly string[] | undefined): {
  cascadeOf: (key: string) => CascadeItem | undefined;
  endCascade: () => void;
} {
  const [appeared, setAppeared] = useState(false);
  const [cascade, setCascade] = useState<Cascade | null>(null);

  if (!appeared && keys !== undefined) {
    setAppeared(true);
    const cascadeMaxMs = motionDurationMs('--motion-cascade-max');
    const enterMs = motionDurationMs('--motion-duration-enter');
    if (keys.length > 0 && cascadeMaxMs > 0 && enterMs > 0) {
      const delays = cascadeDelaysMs(keys.length, cascadeMaxMs, enterMs);
      setCascade({
        delays: new Map(keys.map((key, index) => [key, delays[index] ?? 0])),
        endsAfterMs: (delays[delays.length - 1] ?? 0) + enterMs,
      });
    }
  }

  useEffect(() => {
    if (!cascade) return;
    const timer = setTimeout(() => setCascade(null), cascade.endsAfterMs);
    return () => clearTimeout(timer);
  }, [cascade]);

  const cascadeOf = useCallback(
    (key: string): CascadeItem | undefined => {
      const delay = cascade?.delays.get(key);
      if (delay === undefined) return undefined;
      return { className: 'cascade-item', style: { '--cascade-delay': `${delay}ms` } as CSSProperties };
    },
    [cascade],
  );
  const endCascade = useCallback(() => setCascade(null), []);
  return { cascadeOf, endCascade };
}
