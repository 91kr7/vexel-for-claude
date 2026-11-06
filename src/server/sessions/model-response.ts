export interface ModelResponse {
  key: string;
  model: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheWrite5m?: number;
  cacheWrite1h?: number;
  cacheRead: number;
  sidechain: boolean;
}

const SYNTHETIC_MODEL = '<synthetic>';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const countOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

function cacheWriteSplitOf(usage: Record<string, unknown>, cacheWrite: number): { cacheWrite5m: number; cacheWrite1h: number } {
  const split = usage.cache_creation;
  if (isRecord(split)) {
    const cacheWrite5m = countOf(split.ephemeral_5m_input_tokens);
    const cacheWrite1h = countOf(split.ephemeral_1h_input_tokens);
    if (cacheWrite5m + cacheWrite1h === cacheWrite) return { cacheWrite5m, cacheWrite1h };
  }
  return { cacheWrite5m: cacheWrite, cacheWrite1h: 0 };
}

export function modelResponseOf(entry: unknown): ModelResponse | undefined {
  if (!isRecord(entry) || entry.type !== 'assistant' || !isRecord(entry.message)) return undefined;
  const { id, model, usage } = entry.message;
  if (!isRecord(usage) || model === SYNTHETIC_MODEL) return undefined;
  const key = typeof id === 'string' ? id : entry.uuid;
  if (typeof key !== 'string') return undefined;
  const cacheWrite = countOf(usage.cache_creation_input_tokens);
  return {
    key,
    model: typeof model === 'string' ? model : '',
    input: countOf(usage.input_tokens),
    output: countOf(usage.output_tokens),
    cacheWrite,
    ...cacheWriteSplitOf(usage, cacheWrite),
    cacheRead: countOf(usage.cache_read_input_tokens),
    sidechain: entry.isSidechain === true,
  };
}
