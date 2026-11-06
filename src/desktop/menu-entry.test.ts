// Tests of plan-desktop_app, batch desktop-window: MenuEntry and AppIcon specs (REQ-2).
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applicationsDir, installMenuEntry, menuEntryContent } from './menu-entry.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'ai-client-menu-test-'));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Undoes the string escapes of a Desktop Entry value (`\s`, `\n`, `\t`, `\r`, `\\`). */
function unescapeValue(value: string): string {
  return value.replace(/\\([sntr\\])/g, (_match, c: string) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[c] ?? c);
}

/** Keys of the `[Desktop Entry]` group; it must be the first group. */
function parseEntry(content: string): Map<string, string> {
  const lines = content.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#'));
  expect(lines[0]).toBe('[Desktop Entry]');
  const keys = new Map<string, string>();
  for (const line of lines.slice(1)) {
    if (line.startsWith('[')) break;
    const equals = line.indexOf('=');
    keys.set(line.slice(0, equals).trim(), line.slice(equals + 1).trim());
  }
  return keys;
}

const RESERVED = new Set([' ', '\t', '\n', '"', "'", '\\', '>', '<', '~', '|', '&', ';', '$', '*', '?', '#', '(', ')', '`']);

/** Splits an Exec value into arguments as the Desktop Entry specification defines; it throws on an unquoted reserved character. */
function parseExec(raw: string): string[] {
  const value = unescapeValue(raw);
  const args: string[] = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (quoted) {
      if (c === '\\' && i + 1 < value.length && '"`$\\'.includes(value[i + 1]!)) current += value[++i];
      else if (c === '"') quoted = false;
      else if (c === '%') {
        if (value[++i] !== '%') throw new Error('field code inside a quoted argument');
        current += '%';
      } else current += c;
    } else if (c === ' ') {
      if (started) args.push(current);
      current = '';
      started = false;
    } else if (c === '"') {
      quoted = true;
      started = true;
    } else if (c === '%') {
      const next = value[++i];
      if (next === '%') current += '%';
      else if (next === undefined || !'fFuUdDnNickvm'.includes(next)) throw new Error(`invalid field code %${next}`);
      started = true;
    } else {
      if (RESERVED.has(c)) throw new Error(`unquoted reserved character ${c} in Exec`);
      current += c;
      started = true;
    }
  }
  if (quoted) throw new Error('unterminated quote in Exec');
  if (started) args.push(current);
  return args;
}

/** Writes a fake Electron that records AI_CLIENT_NODE and its arguments, one per line. */
async function fakeElectron(dir: string): Promise<{ electronPath: string; output: string }> {
  await mkdir(dir, { recursive: true });
  const electronPath = path.join(dir, 'electron bin');
  const output = path.join(tmp, `exec-output-${Math.random().toString(36).slice(2)}`);
  await writeFile(electronPath, `#!/bin/sh\nprintf '%s\\n' "$AI_CLIENT_NODE" "$@" > '${output}'\n`);
  await chmod(electronPath, 0o755);
  return { electronPath, output };
}

/** Runs the Exec line without a shell, with a system PATH that has no `node`, as a desktop session would. */
async function runExec(exec: string): Promise<void> {
  const [file, ...args] = parseExec(exec);
  expect(file).toBeDefined();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file!, args, { env: { PATH: '/usr/bin:/bin' }, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Exec exited with ${code}`))));
  });
}

describe('menuEntryContent', () => {
  const options = { repoRoot: '/home/user/ai-client', electronPath: '/home/user/ai-client/node_modules/electron/dist/electron', nodePath: '/opt/node/bin/node' };

  it('declares the application keys', () => {
    const keys = parseEntry(menuEntryContent(options));
    expect(keys.get('Type')).toBe('Application');
    expect(keys.get('Name')).toBe('Vexel for Claude');
    expect(keys.get('Comment')).toBe('Manage Claude Code sessions');
    expect(keys.get('Terminal')).toBe('false');
    expect(keys.get('Categories')).toBe('Development;');
    expect(keys.get('StartupWMClass')).toBe('ai-client');
  });

  it('points Icon to the absolute path of the AppIcon SVG in the repository', () => {
    const keys = parseEntry(menuEntryContent({ ...options, repoRoot }));
    const icon = unescapeValue(keys.get('Icon') ?? '');
    expect(icon).toBe(path.join(repoRoot, 'src/desktop/icons/vexel-for-claude.svg'));
    expect(existsSync(icon)).toBe(true);
  });

  it('Exec uses absolute paths only', () => {
    const args = parseExec(parseEntry(menuEntryContent(options)).get('Exec') ?? '');
    const paths = args.map((arg) => arg.replace(/^AI_CLIENT_NODE=/, ''));
    expect(paths.filter((arg) => !path.isAbsolute(arg))).toEqual([]);
  });

  it('Exec runs Electron on the repository with AI_CLIENT_NODE', async () => {
    const { electronPath, output } = await fakeElectron(path.join(tmp, 'plain'));
    const exec = parseEntry(menuEntryContent({ ...options, electronPath })).get('Exec') ?? '';
    await runExec(exec);
    expect((await readFile(output, 'utf8')).split('\n').filter(Boolean)).toEqual([options.nodePath, options.repoRoot]);
  });

  it('Exec quotes paths with spaces and shell special characters', async () => {
    const { electronPath, output } = await fakeElectron(path.join(tmp, 'my apps $HOME'));
    const special = { repoRoot: `/home/user/my "repo" $HOME \`x\` \\ (a);b&c`, electronPath, nodePath: '/opt/my node/bin/node' };
    const exec = parseEntry(menuEntryContent(special)).get('Exec') ?? '';
    await runExec(exec);
    expect((await readFile(output, 'utf8')).split('\n').filter(Boolean)).toEqual([special.nodePath, special.repoRoot]);
  });

  it('Exec escapes a literal percent sign', async () => {
    const { electronPath, output } = await fakeElectron(path.join(tmp, 'percent'));
    const withPercent = { ...options, repoRoot: '/home/user/repo 100%', electronPath };
    await runExec(parseEntry(menuEntryContent(withPercent)).get('Exec') ?? '');
    expect((await readFile(output, 'utf8')).split('\n').filter(Boolean)).toEqual([options.nodePath, withPercent.repoRoot]);
  });
});

describe('applicationsDir', () => {
  it('uses AI_CLIENT_APPLICATIONS_DIR when set', () => {
    expect(applicationsDir({ AI_CLIENT_APPLICATIONS_DIR: '/tmp/apps', XDG_DATA_HOME: '/tmp/xdg', HOME: os.homedir() })).toBe('/tmp/apps');
  });

  it('else uses XDG_DATA_HOME/applications', () => {
    expect(applicationsDir({ XDG_DATA_HOME: '/tmp/xdg', HOME: os.homedir() })).toBe('/tmp/xdg/applications');
  });

  it('else defaults to ~/.local/share/applications', () => {
    expect(applicationsDir({ HOME: os.homedir() })).toBe(path.join(os.homedir(), '.local/share/applications'));
  });
});

describe('installMenuEntry', () => {
  const options = { repoRoot, electronPath: '/opt/electron', nodePath: '/opt/node' };

  it('creates the target folder and writes vexel-for-claude.desktop, returning its path', async () => {
    const targetDir = path.join(tmp, 'new/nested/applications');
    const file = await installMenuEntry({ targetDir, ...options });
    expect(file).toBe(path.join(targetDir, 'vexel-for-claude.desktop'));
    expect(await readFile(file, 'utf8')).toBe(menuEntryContent(options));
  });

  it('replaces an older entry', async () => {
    const targetDir = path.join(tmp, 'existing');
    await mkdir(targetDir);
    await writeFile(path.join(targetDir, 'vexel-for-claude.desktop'), '[Desktop Entry]\nName=Old\n');
    const file = await installMenuEntry({ targetDir, ...options });
    expect(await readFile(file, 'utf8')).toBe(menuEntryContent(options));
  });
});

describe('install command', () => {
  it('installs the entry in applicationsDir with the running Node and the repository Electron, and prints the path', async () => {
    const home = path.join(tmp, 'home');
    const targetDir = path.join(tmp, 'command-applications');
    await mkdir(home);
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/desktop/install-menu-entry.ts'], {
      cwd: repoRoot,
      env: { ...process.env, HOME: home, XDG_DATA_HOME: path.join(home, 'xdg'), AI_CLIENT_APPLICATIONS_DIR: targetDir },
      timeout: 30_000,
    });
    const file = path.join(targetDir, 'vexel-for-claude.desktop');
    expect(stdout).toContain(file);
    const electronPath = createRequire(import.meta.url)('electron') as string;
    expect(await readFile(file, 'utf8')).toBe(menuEntryContent({ repoRoot, electronPath, nodePath: process.execPath }));
  }, 40_000);
});

describe('AppIcon', () => {
  const icons = path.join(repoRoot, 'src/desktop/icons');

  it('the PNG is 256 × 256 with transparency', async () => {
    const png = await readFile(path.join(icons, 'vexel-for-claude.png'));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(256);
    const colourType = png[25];
    expect(colourType === 4 || colourType === 6 || png.includes(Buffer.from('tRNS'))).toBe(true);
  });

  it('the SVG has the logo colours and draws the letters as paths, not text', async () => {
    const svg = (await readFile(path.join(icons, 'vexel-for-claude.svg'), 'utf8')).toLowerCase();
    expect(svg).toContain('#8ccfff');
    expect(svg).toContain('#008ef4');
    expect(svg).toContain('#0b0b0e');
    expect(svg).toContain('<path');
    expect(svg).not.toMatch(/<text[\s>]/);
  });
});
