import { useEffect, useRef, useState } from 'react';

export interface PlanLimit {
  label: string;
  percent: number;
  resetsAt: string | null;
}

export type PlanUsageState =
  | { kind: 'loading' }
  | { kind: 'ready'; limits: PlanLimit[]; readAt: number }
  | { kind: 'unavailable' }
  | { kind: 'stale'; lastReadAt: number };

export const PLAN_USAGE_REFRESH_MS = 60_000;

const LOADING: PlanUsageState = { kind: 'loading' };

function isPlanLimit(value: unknown): value is PlanLimit {
  if (typeof value !== 'object' || value === null) return false;
  const { label, percent, resetsAt } = value as Record<string, unknown>;
  return typeof label === 'string' && typeof percent === 'number' && Number.isFinite(percent) && (resetsAt === null || typeof resetsAt === 'string');
}

async function loadLimits(signal: AbortSignal): Promise<PlanLimit[] | undefined> {
  try {
    const response = await fetch('/api/plan-usage', { signal });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { status?: unknown; limits?: unknown };
    if (body.status !== 'ok' || !Array.isArray(body.limits) || body.limits.length === 0) return undefined;
    return body.limits.every(isPlanLimit) ? body.limits : undefined;
  } catch {
    return undefined;
  }
}

export function usePlanUsage(open: boolean): PlanUsageState {
  const [state, setState] = useState<PlanUsageState>(LOADING);
  const lastReadAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      lastReadAt.current = undefined;
      setState(LOADING);
      return;
    }
    lastReadAt.current = undefined;
    setState(LOADING);
    let active = true;
    let sequence = 0;
    const controller = new AbortController();
    const load = async () => {
      const mine = ++sequence;
      const limits = await loadLimits(controller.signal);
      if (!active || mine !== sequence) return;
      if (limits) {
        const readAt = Date.now();
        lastReadAt.current = readAt;
        setState({ kind: 'ready', limits, readAt });
      } else {
        const last = lastReadAt.current;
        setState(last === undefined ? { kind: 'unavailable' } : { kind: 'stale', lastReadAt: last });
      }
    };
    void load();
    const timer = setInterval(() => void load(), PLAN_USAGE_REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [open]);

  return open ? state : LOADING;
}
