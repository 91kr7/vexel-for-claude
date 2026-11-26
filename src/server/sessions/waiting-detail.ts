import { mainArgumentOf } from '../external/transcript-reader.js';
import type { HookEvent } from './session-state-tracker.js';

export interface WaitingQuestion {
  question: string;
  options: string[];
}

export type WaitingDetail = { kind: 'argument'; text: string } | { kind: 'questions'; questions: WaitingQuestion[] };

const ASK_USER_QUESTION = 'AskUserQuestion';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function questionOf(value: unknown): WaitingQuestion | undefined {
  if (!isRecord(value) || !isText(value.question)) return undefined;
  const options = Array.isArray(value.options) ? value.options : [];
  const labels = options.map((option) => (isRecord(option) ? option.label : undefined)).filter(isText);
  return { question: value.question, options: labels };
}

export function waitingDetailOf(event: Pick<HookEvent, 'hook_event_name' | 'tool_name' | 'tool_input'>): WaitingDetail | undefined {
  if (event.hook_event_name !== 'PreToolUse' && event.hook_event_name !== 'PermissionRequest') return undefined;
  if (event.tool_name === ASK_USER_QUESTION) {
    const items = isRecord(event.tool_input) && Array.isArray(event.tool_input.questions) ? event.tool_input.questions : [];
    const questions = items.map(questionOf).filter((question) => question !== undefined);
    return questions.length > 0 ? { kind: 'questions', questions } : undefined;
  }
  const text = mainArgumentOf(event.tool_input);
  return isText(text) ? { kind: 'argument', text } : undefined;
}
