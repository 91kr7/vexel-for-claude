import { userMessageOf } from '../history/session-history.js';

export type SubagentState = 'running' | 'finished' | 'stopped';

export interface SubagentFacts {
  finished?: boolean;
  interrupted: boolean;
  sessionEnded: boolean;
}

const TASK_NOTIFICATION = /^<task-notification>/;
const TASK_ID = /<task-id>([^<]+)<\/task-id>/;
const STATUS = /<status>([^<]+)<\/status>/;
const STOP_STATUSES = new Set(['killed', 'stopped', 'failed']);

export function subagentStateOf({ finished, interrupted, sessionEnded }: SubagentFacts): SubagentState {
  if (finished === true) return 'finished';
  return sessionEnded || interrupted ? 'stopped' : 'running';
}

export function stoppedTaskIdOf(entry: Record<string, unknown>): string | undefined {
  const text = userMessageOf(entry);
  if (text === null || !TASK_NOTIFICATION.test(text)) return undefined;
  const status = STATUS.exec(text)?.[1]?.trim();
  const taskId = TASK_ID.exec(text)?.[1]?.trim();
  return status !== undefined && STOP_STATUSES.has(status) && taskId ? taskId : undefined;
}
