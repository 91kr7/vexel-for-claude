const STANDARD_WINDOW = 200_000;
const EXTENDED_WINDOW = 1_000_000;

const EXTENDED_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);
const DATE_SUFFIX = /-\d{8}$/;

export function contextWindowOf(model: string, used: number): number {
  const id = model.replace(DATE_SUFFIX, '');
  if (EXTENDED_MODELS.has(id) || model.toLowerCase().includes('[1m]') || used > STANDARD_WINDOW) return EXTENDED_WINDOW;
  return STANDARD_WINDOW;
}
