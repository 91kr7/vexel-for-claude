import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOK_FORWARDER = fileURLToPath(new URL('./hook-forwarder.mjs', import.meta.url));
const HOOK_TIMEOUT_SECONDS = 10;
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PermissionRequest'] as const;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function hookCommand(serverUrl: string): string {
  return [process.execPath, HOOK_FORWARDER, serverUrl].map(shellQuote).join(' ');
}

export function buildHookSettings(serverUrl: string): object {
  const hooks = [{ type: 'command', command: hookCommand(serverUrl), timeout: HOOK_TIMEOUT_SECONDS }];
  return {
    hooks: {
      UserPromptSubmit: [{ hooks }],
      ...Object.fromEntries(TOOL_EVENTS.map((event) => [event, [{ matcher: '*', hooks }]])),
      Notification: [{ matcher: 'permission_prompt|elicitation_dialog|idle_prompt', hooks }],
      Stop: [{ hooks }],
    },
  };
}

export async function writeHookSettings(serverUrl: string, dir?: string): Promise<string> {
  const folder = dir ?? (await mkdtemp(path.join(os.tmpdir(), 'ai-client-hooks-')));
  const file = path.join(folder, 'hook-settings.json');
  await writeFile(file, `${JSON.stringify(buildHookSettings(serverUrl), null, 2)}\n`, { mode: 0o600 });
  return file;
}
