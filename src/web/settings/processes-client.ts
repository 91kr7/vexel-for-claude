export type ProcessKind = 'app-server' | 'test-server' | 'fake-claude' | 'claude-session';

export interface ProcessRow {
  kind: ProcessKind;
  pid: number;
  startedAt: number;
  port?: number;
  folder?: string;
  label?: string;
  thisInstance: boolean;
  hosted: boolean;
  hanging: boolean;
}

export type ProcessesResult = { status: 'loaded'; processes: ProcessRow[] } | { status: 'failed' };

const KINDS: readonly string[] = ['app-server', 'test-server', 'fake-claude', 'claude-session'];
const FAILED: ProcessesResult = { status: 'failed' };

const optional = (value: unknown, type: 'number' | 'string') => value === undefined || typeof value === type;

function isProcessRow(value: unknown): value is ProcessRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.kind === 'string' &&
    KINDS.includes(row.kind) &&
    typeof row.pid === 'number' &&
    typeof row.startedAt === 'number' &&
    typeof row.thisInstance === 'boolean' &&
    typeof row.hosted === 'boolean' &&
    typeof row.hanging === 'boolean' &&
    optional(row.port, 'number') &&
    optional(row.folder, 'string') &&
    optional(row.label, 'string')
  );
}

export async function loadProcesses(signal?: AbortSignal): Promise<ProcessesResult> {
  try {
    const response = await fetch('/api/processes', { signal });
    if (response.status !== 200) return FAILED;
    const body = (await response.json()) as { processes?: unknown } | null;
    const processes = body?.processes;
    return Array.isArray(processes) && processes.every(isProcessRow) ? { status: 'loaded', processes } : FAILED;
  } catch {
    return FAILED;
  }
}
