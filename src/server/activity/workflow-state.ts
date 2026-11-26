import type { SubagentState } from './subagent-state.js';

export interface WorkflowSubagentFacts {
  result: boolean;
  launchOver: boolean;
  startedBeforeLatestLaunch: boolean;
  sessionEnded: boolean;
}

export interface WorkflowLaunchIds {
  runId: string;
  taskId?: string;
}

type Entry = Record<string, unknown>;

const TASK_NOTIFICATION = /^<task-notification>/;
const TASK_ID_TAG = /<task-id>([^<]+)<\/task-id>/;
const RUN_ID_TEXT = /Run ID: (\S+)/;
const TASK_ID_TEXT = /Task ID: (\S+)/;
const TASK_STOPPED_TEXT = 'Successfully stopped task';

const isRecord = (value: unknown): value is Entry => typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyText = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

function resultBlockOf(entry: Entry, toolUseId: string): Entry | undefined {
  const content = isRecord(entry.message) ? entry.message.content : undefined;
  const blocks: unknown[] = Array.isArray(content) ? content : [];
  return blocks.find((block): block is Entry => isRecord(block) && block.type === 'tool_result' && block.tool_use_id === toolUseId);
}

function textOf(block: Entry): string {
  if (typeof block.content === 'string') return block.content;
  const parts: unknown[] = Array.isArray(block.content) ? block.content : [];
  return parts
    .filter((part): part is Entry => isRecord(part) && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n');
}

export function workflowSubagentStateOf({ result, launchOver, startedBeforeLatestLaunch, sessionEnded }: WorkflowSubagentFacts): SubagentState {
  if (result) return 'finished';
  return launchOver || startedBeforeLatestLaunch || sessionEnded ? 'stopped' : 'running';
}

export function workflowLaunchOf(entry: Entry, toolUseId: string): WorkflowLaunchIds | undefined {
  const block = resultBlockOf(entry, toolUseId);
  if (!block || block.is_error === true) return undefined;
  const text = textOf(block);
  const launch: Entry = isRecord(entry.toolUseResult) ? entry.toolUseResult : {};
  const runId = nonEmptyText(launch.runId) ?? RUN_ID_TEXT.exec(text)?.[1];
  const taskId = nonEmptyText(launch.taskId) ?? TASK_ID_TEXT.exec(text)?.[1];
  return runId === undefined ? undefined : { runId, ...(taskId !== undefined && { taskId }) };
}

export function taskStopSucceeded(entry: Entry, toolUseId: string): boolean {
  const block = resultBlockOf(entry, toolUseId);
  return block !== undefined && block.is_error !== true && textOf(block).includes(TASK_STOPPED_TEXT);
}

export function notifiedTaskIdOf(text: string): string | undefined {
  if (!TASK_NOTIFICATION.test(text)) return undefined;
  return TASK_ID_TAG.exec(text)?.[1]?.trim() || undefined;
}
