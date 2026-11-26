import { userMessageOf } from '../history/session-history.js';

const INTERRUPT_MARKER = '[Request interrupted by user';
const TASK_NOTIFICATION = '<task-notification>';

export function isInterruptMarker(text: string): boolean {
  return text.startsWith(INTERRUPT_MARKER);
}

function addedByClaudeCode(entry: Record<string, unknown>, text: string): boolean {
  const origin = entry.origin;
  const kind = typeof origin === 'object' && origin !== null ? (origin as { kind?: unknown }).kind : undefined;
  return (typeof kind === 'string' && kind !== 'human') || entry.isCompactSummary === true || text.startsWith(TASK_NOTIFICATION);
}

export function startsTurn(entry: Record<string, unknown>): boolean {
  const text = userMessageOf(entry);
  return text !== null && !isInterruptMarker(text) && !addedByClaudeCode(entry, text);
}
