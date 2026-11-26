import { runningToolOf } from '../sessions/running-tool.js';
import type { OpenCall, SubagentView } from './turn-model.js';

export interface WaitingTool {
  subagentType?: string;
  name: string;
  argument?: string;
  others: number;
}

export type WaitingFor = 'response' | WaitingTool;

export function waitingForOf(calls: readonly OpenCall[], running: readonly Pick<SubagentView, 'meta'>[]): WaitingFor {
  const subagentStarts = new Set(running.map((subagent) => subagent.meta.toolUseId));
  const waiting = calls.filter((call) => !subagentStarts.has(call.id));
  const first = waiting[0];
  const tool = first && runningToolOf([first]);
  if (!first || !tool) return 'response';
  const { subagentType } = first;
  return { ...(subagentType && { subagentType }), ...tool, others: waiting.length - 1 };
}
