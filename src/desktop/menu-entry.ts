import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const MENU_ENTRY_FILE = 'vexel-for-claude.desktop';

export interface MenuEntryOptions {
  repoRoot: string;
  electronPath: string;
  nodePath: string;
}

// Desktop Entry spec: quoting for reserved characters, then the string escape that doubles backslashes.
function execArgument(value: string): string {
  const escaped = value.replaceAll('%', '%%');
  const quoted = /[\s"'\\><~|&;$*?#()`]/.test(escaped)
    ? `"${escaped.replace(/["`$\\]/g, '\\$&')}"`
    : escaped;
  return quoted.replaceAll('\\', '\\\\');
}

export function menuEntryContent({ repoRoot, electronPath, nodePath }: MenuEntryOptions): string {
  const exec = ['/usr/bin/env', `AI_CLIENT_NODE=${nodePath}`, electronPath, repoRoot].map(execArgument).join(' ');
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Vexel for Claude',
    'Comment=Manage Claude Code sessions',
    `Exec=${exec}`,
    `Icon=${path.join(repoRoot, 'src/desktop/icons/vexel-for-claude.svg')}`,
    'Terminal=false',
    'Categories=Development;',
    'StartupWMClass=ai-client',
    '',
  ].join('\n');
}

export function applicationsDir(env: NodeJS.ProcessEnv): string {
  if (env.AI_CLIENT_APPLICATIONS_DIR) return env.AI_CLIENT_APPLICATIONS_DIR;
  const dataHome = env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share');
  return path.join(dataHome, 'applications');
}

export async function installMenuEntry(options: MenuEntryOptions & { targetDir: string }): Promise<string> {
  await mkdir(options.targetDir, { recursive: true });
  const file = path.join(options.targetDir, MENU_ENTRY_FILE);
  await writeFile(file, menuEntryContent(options));
  return file;
}
