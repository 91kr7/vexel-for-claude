import { readAccessToken } from './claude-credentials-token.js';
import { type PlanLimit, planLimitsOf } from './plan-limits-rule.js';
import { defaultClaudeDir } from './history/session-history.js';

export type PlanLimitsResult = { status: 'ok'; limits: PlanLimit[] } | { status: 'unavailable' } | { status: 'error' };

export interface PlanLimitsReaderOptions {
  claudeDir?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA_HEADER = 'oauth-2025-04-20';
const DEFAULT_TIMEOUT_MS = 10_000;

export class PlanLimitsReader {
  readonly #claudeDir: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: PlanLimitsReaderOptions = {}) {
    this.#claudeDir = options.claudeDir;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async read(): Promise<PlanLimitsResult> {
    const token = await readAccessToken(this.#claudeDir ?? defaultClaudeDir());
    if (token === undefined) return { status: 'unavailable' };
    try {
      const response = await this.#fetch(USAGE_URL, {
        headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': BETA_HEADER, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
      if (response.status !== 200) return { status: 'error' };
      const limits = planLimitsOf(await response.json());
      return limits.length > 0 ? { status: 'ok', limits } : { status: 'error' };
    } catch {
      return { status: 'error' };
    }
  }
}
