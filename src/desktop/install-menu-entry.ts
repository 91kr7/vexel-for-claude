import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationsDir, installMenuEntry } from './menu-entry.js';

const electronPath: string = createRequire(import.meta.url)('electron');

const file = await installMenuEntry({
  targetDir: applicationsDir(process.env),
  repoRoot: path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
  electronPath,
  nodePath: process.execPath,
});
console.log(`Installed ${file}`);
