import type { MessageBoxOptions } from 'electron';

const SESSIONS_TIMEOUT_MS = 2_000;
const BUSY_STATES = new Set(['working', 'needs_input']);
const QUIT_BUTTON = 1;

export interface QuitBackend {
  origin: string;
  startedByApp: boolean;
}

export type AskQuit = (options: MessageBoxOptions) => Promise<{ response: number }>;

export async function countBusySessions(origin: string): Promise<number> {
  try {
    const response = await fetch(`${origin}/api/sessions`, { signal: AbortSignal.timeout(SESSIONS_TIMEOUT_MS) });
    if (response.status !== 200) return 0;
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return 0;
    return body.filter((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const { state, external } = entry as { state?: unknown; external?: unknown };
      return external !== true && typeof state === 'string' && BUSY_STATES.has(state);
    }).length;
  } catch {
    return 0;
  }
}

export function quitConfirmation(count: number): MessageBoxOptions {
  return {
    type: 'warning',
    title: 'Quit Vexel for Claude?',
    message: 'Quit Vexel for Claude?',
    detail:
      count === 1
        ? '1 session is working or needs input. Quitting ends it.'
        : `${count} sessions are working or need input. Quitting ends them.`,
    buttons: ['Cancel', 'Quit'],
    defaultId: 0,
    cancelId: 0,
  };
}

export async function confirmQuit(backend: QuitBackend | undefined, ask: AskQuit): Promise<boolean> {
  if (!backend?.startedByApp) return true;
  const count = await countBusySessions(backend.origin);
  if (count === 0) return true;
  const { response } = await ask(quitConfirmation(count));
  return response === QUIT_BUTTON;
}
