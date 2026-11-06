import { mainArgumentOf } from '../external/transcript-reader.js';

export interface OpenToolCall {
  name: string;
  input?: unknown;
}

export interface RunningTool {
  name: string;
  argument?: string;
  others: number;
}

export function runningToolOf(calls: readonly OpenToolCall[]): RunningTool | undefined {
  const last = calls.at(-1);
  if (!last) return undefined;
  const argument = mainArgumentOf(last.input)?.split(/\r\n|\r|\n/)[0]?.trim();
  return { name: last.name, ...(argument && { argument }), others: calls.length - 1 };
}
