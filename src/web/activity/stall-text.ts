import type { WaitingFor } from '../sessions/live-session-store';
import { shortDuration } from './short-duration';

export function stallText(silenceMs: number, waitingFor?: WaitingFor): string {
  const text = `No activity for ${shortDuration(silenceMs)}`;
  if (waitingFor === undefined) return text;
  if (waitingFor === 'response') return `${text} · waiting for Claude's response`;
  const type = waitingFor.subagentType ? `${waitingFor.subagentType}: ` : '';
  const tool = waitingFor.argument || waitingFor.name;
  const others = waitingFor.others > 0 ? ` +${waitingFor.others}` : '';
  return `${text} · ${type}${tool ? `${tool} ` : ''}running${others}`;
}
