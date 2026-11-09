export interface PlanLimit {
  label: string;
  percent: number;
  resetsAt: string | null;
}

const SESSION_LABEL = 'Current session';
const WEEKLY_ALL_LABEL = 'Current week (all models)';

const FALLBACK_KEYS: readonly { key: string; label: string }[] = [
  { key: 'five_hour', label: SESSION_LABEL },
  { key: 'seven_day', label: WEEKLY_ALL_LABEL },
  { key: 'seven_day_opus', label: 'Current week (Opus)' },
  { key: 'seven_day_sonnet', label: 'Current week (Sonnet)' },
];

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function limitOf(label: string, percent: unknown, resetsAt: unknown): PlanLimit | undefined {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return undefined;
  return { label, percent: Math.round(percent), resetsAt: typeof resetsAt === 'string' ? resetsAt : null };
}

function labelOfRow(row: Record<string, unknown>): string | undefined {
  if (row.kind === 'session') return SESSION_LABEL;
  if (row.kind === 'weekly_all') return WEEKLY_ALL_LABEL;
  if (row.kind !== 'weekly_scoped') return undefined;
  const name = recordOf(recordOf(row.scope)?.model)?.display_name;
  return typeof name === 'string' && name !== '' ? `Current week (${name})` : undefined;
}

function fromLimitsArray(rows: unknown[]): PlanLimit[] {
  const limits: PlanLimit[] = [];
  for (const item of rows) {
    const row = recordOf(item);
    const label = row && labelOfRow(row);
    const limit = row && label !== undefined ? limitOf(label, row.percent, row.resets_at) : undefined;
    if (limit) limits.push(limit);
  }
  return limits;
}

function fromFallbackKeys(body: Record<string, unknown>): PlanLimit[] {
  const limits: PlanLimit[] = [];
  for (const { key, label } of FALLBACK_KEYS) {
    const entry = recordOf(body[key]);
    const limit = entry && limitOf(label, entry.utilization, entry.resets_at);
    if (limit) limits.push(limit);
  }
  return limits;
}

export function planLimitsOf(body: unknown): PlanLimit[] {
  const record = recordOf(body);
  if (!record) return [];
  if (Array.isArray(record.limits) && record.limits.length > 0) {
    const limits = fromLimitsArray(record.limits);
    if (limits.length > 0) return limits;
  }
  return fromFallbackKeys(record);
}
