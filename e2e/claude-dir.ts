import os from 'node:os';
import path from 'node:path';

/** Claude Code folder of the e2e server (CLAUDE_CONFIG_DIR): fixtures only, never the real `~/.claude`. */
export const E2E_CLAUDE_DIR = path.join(os.tmpdir(), 'ai-client-e2e-claude');
