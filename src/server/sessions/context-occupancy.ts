import { contextWindowOf } from './context-window.js';
import { modelResponseOf } from './model-response.js';

export interface ContextOccupancy {
  used: number;
  window: number;
}

const isCompactBoundary = (entry: unknown): boolean =>
  typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).type === 'system' && (entry as Record<string, unknown>).subtype === 'compact_boundary';

export function contextAfter(previous: ContextOccupancy | undefined, entries: Iterable<unknown>): ContextOccupancy | undefined {
  let context = previous;
  for (const entry of entries) {
    if (isCompactBoundary(entry)) {
      context = undefined;
      continue;
    }
    const response = modelResponseOf(entry);
    if (!response || response.sidechain) continue;
    const used = response.input + response.cacheWrite + response.cacheRead;
    context = { used, window: contextWindowOf(response.model, used) };
  }
  return context;
}
