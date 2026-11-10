import { useEffect, useState } from 'react';

export interface PlanLimit {
  label: string;
  percent: number;
  resetsAt: string | null;
}

export type PlanUsageState =
  | { kind: 'loading' }
  | { kind: 'ready'; limits: PlanLimit[]; readAt: number }
  | { kind: 'unavailable' };

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

// One request per opening of the popover: no periodic refresh, so the usage endpoint is not hit again while it stays open.
export function usePlanUsage(open: boolean): PlanUsageState {
  const [state, setState] = useState<PlanUsageState>(LOADING);

  useEffect(() => {
    setState(LOADING);
    if (!open) return;
    const controller = new AbortController();
    void loadLimits(controller.signal).then((limits) => {
      if (controller.signal.aborted) return;
      setState(limits ? { kind: 'ready', limits, readAt: Date.now() } : { kind: 'unavailable' });
    });
    return () => controller.abort();
  }, [open]);

  return open ? state : LOADING;
}
