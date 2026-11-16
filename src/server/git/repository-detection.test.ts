// Unit tests of detectRepositories (plan-multi_repo_workspace, batch repo-detection), on real git repositories in temp folders.
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git, repoWithCommit, tempFolder } from './git-fixtures.js';
import { GitError, GitRunner } from './git-runner.js';
import { detectRepositories } from './repository-detection.js';

type Runner = Pick<GitRunner, 'run'>;

const SKIPPED = [
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  '.gradle',
  '.m2',
  'target',
  'build',
  'dist',
  'out',
  '.next',
  '.nuxt',
  '.dart_tool',
  'Pods',
  '.terraform',
];

let dir: string;
const runner = new GitRunner();
const main = { kind: 'branch', name: 'main' } as const;

beforeAll(async () => {
  dir = await tempFolder('ai-client-detection-');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

let count = 0;
/** A new plain folder (not a repository) inside the temp folder. */
async function workspace(): Promise<string> {
  const folder = path.join(dir, `ws-${(count += 1)}`);
  await mkdir(folder);
  return folder;
}

/** A repository with one commit at `relative` below `parent`. */
const repoAt = (parent: string, relative: string) => repoWithCommit(path.dirname(path.join(parent, relative)), path.basename(relative));

async function detectedPaths(folder: string): Promise<string[]> {
  const result = await detectRepositories(runner, folder);
  return result.status === 'repositories' ? result.repositories.map((r) => r.path) : [];
}

describe('detectRepositories: which repositories are covered', () => {
  // plan-multi_repo_workspace/REQ-2, REQ-7
  it('finds the repositories below a plain folder with root, name, relative path and branch', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    const app = await repoAt(ws, 'web/app');
    expect(await detectRepositories(runner, ws)).toEqual({
      status: 'repositories',
      repositories: [
        { root: api, name: 'api', path: 'api', branch: main },
        { root: app, name: 'app', path: 'web/app', branch: main },
      ],
    });
  });

  // plan-multi_repo_workspace/REQ-2: depth limit, level 4 found, level 5 not
  it('finds a repository at level 4 and not one at level 5', async () => {
    const ws = await workspace();
    await repoAt(ws, 'a/b/c/d');
    await repoAt(ws, 'x/y/z/w/deep');
    expect(await detectedPaths(ws)).toEqual(['a/b/c/d']);
  });

  it('does not look inside a level-4 repository', async () => {
    const ws = await workspace();
    await repoAt(ws, 'a/b/c/d');
    await repoAt(ws, 'a/b/c/d/e');
    expect(await detectedPaths(ws)).toEqual(['a/b/c/d']);
  });

  // plan-multi_repo_workspace/REQ-2: also inside another covered repository
  it('finds a repository inside another one', async () => {
    const ws = await workspace();
    await repoAt(ws, 'api');
    await repoAt(ws, 'api/plugins/x');
    expect(await detectedPaths(ws)).toEqual(['api', 'api/plugins/x']);
  });

  // plan-multi_repo_workspace/REQ-3
  it('does not enter dependency and build output folders', async () => {
    const ws = await workspace();
    await repoAt(ws, 'kept');
    for (const name of SKIPPED) await repoAt(ws, `${name}/inner`);
    await repoAt(ws, 'kept/node_modules/pkg');
    expect(await detectedPaths(ws)).toEqual(['kept']);
  });

  it('does not enter a skipped folder that is itself a repository', async () => {
    const ws = await workspace();
    await repoAt(ws, 'dist');
    expect(await detectRepositories(runner, ws)).toEqual({ status: 'none' });
  });

  it('does not enter .git', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    await repoAt(api, '.git/hidden');
    expect(await detectedPaths(ws)).toEqual(['api']);
  });

  // plan-multi_repo_workspace/REQ-4
  it('drops a submodule and does not look inside it', async () => {
    const ws = await workspace();
    const source = await repoAt(dir, `submodule-source-${count}`);
    const api = await repoAt(ws, 'api');
    git(api, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'libs/sub');
    git(api, 'commit', '-q', '-m', 'add submodule');
    await repoAt(api, 'libs/sub/inner');
    expect(await detectedPaths(ws)).toEqual(['api']);
  });

  it('covers a linked worktree', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    git(api, 'worktree', 'add', '-q', '-b', 'feature', path.join(ws, 'wt'));
    const result = await detectRepositories(runner, ws);
    expect(result).toEqual({
      status: 'repositories',
      repositories: [
        { root: api, name: 'api', path: 'api', branch: main },
        { root: path.join(ws, 'wt'), name: 'wt', path: 'wt', branch: { kind: 'branch', name: 'feature' } },
      ],
    });
  });

  // Symbolic links are not followed, so a loop ends
  it('does not follow symbolic links, and a link loop ends', async () => {
    const ws = await workspace();
    await repoAt(ws, 'api');
    const outside = await repoAt(dir, `outside-${count}`);
    await symlink(ws, path.join(ws, 'loop'));
    await symlink(outside, path.join(ws, 'linked'));
    expect(await detectedPaths(ws)).toEqual(['api']);
  });

  it('gives a detached HEAD as "detached" and the short hash', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    git(api, 'checkout', '-q', '--detach');
    const result = await detectRepositories(runner, ws);
    expect(result).toEqual({
      status: 'repositories',
      repositories: [{ root: api, name: 'api', path: 'api', branch: { kind: 'detached', hash: git(api, 'rev-parse', '--short', 'HEAD') } }],
    });
  });
});

describe('detectRepositories: the repository around the folder', () => {
  // plan-multi_repo_workspace/REQ-1, REQ-8
  it('gives the repository of the folder first with path ".", then the ones inside it, once each', async () => {
    const ws = await workspace();
    const outer = await repoAt(ws, 'outer');
    const inner = await repoAt(outer, 'inner');
    expect(await detectRepositories(runner, outer)).toEqual({
      status: 'repositories',
      repositories: [
        { root: outer, name: 'outer', path: '.', branch: main },
        { root: inner, name: 'inner', path: 'inner', branch: main },
      ],
    });
  });

  it('gives a ".." path to a repository above the folder', async () => {
    const ws = await workspace();
    const outer = await repoAt(ws, 'outer');
    const folder = path.join(outer, 'src', 'app');
    await mkdir(folder, { recursive: true });
    const inner = await repoAt(folder, 'lib');
    expect(await detectRepositories(runner, folder)).toEqual({
      status: 'repositories',
      repositories: [
        { root: outer, name: 'outer', path: '../..', branch: main },
        { root: inner, name: 'lib', path: 'lib', branch: main },
      ],
    });
  });

  it('gives the repository around the folder first even when its path sorts after the others', async () => {
    const ws = await workspace();
    const outer = await repoAt(ws, 'outer');
    const folder = path.join(outer, 'sub');
    await repoAt(folder, 'aaa');
    expect(await detectedPaths(folder)).toEqual(['..', 'aaa']);
  });

  it('resolves symbolic links in the roots', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    const link = path.join(dir, `link-${count}`);
    await symlink(ws, link);
    const result = await detectRepositories(runner, link);
    expect(result.status === 'repositories' ? result.repositories.map((r) => [r.root, r.name]) : result).toEqual([[api, 'api']]);
  });
});

describe('detectRepositories: order', () => {
  // plan-multi_repo_workspace/REQ-8: paths compare segment by segment
  it('lists the repositories below the folder in path order, segment by segment', async () => {
    const ws = await workspace();
    // A parent repository is created first: its first commit would track a nested one as a gitlink.
    for (const relative of ['web/app', 'api', 'api-2', 'tools', 'api/plugins/x']) await repoAt(ws, relative);
    expect(await detectedPaths(ws)).toEqual(['api', 'api/plugins/x', 'api-2', 'tools', 'web/app']);
  });
});

describe('detectRepositories: none', () => {
  // plan-multi_repo_workspace/REQ-6
  it('gives none for a folder with no repository inside or above it', async () => {
    const ws = await workspace();
    await mkdir(path.join(ws, 'a', 'b'), { recursive: true });
    expect(await detectRepositories(runner, ws)).toEqual({ status: 'none' });
  });

  it('gives none for a folder that does not exist', async () => {
    expect(await detectRepositories(runner, path.join(dir, 'gone'))).toEqual({ status: 'none' });
  });

  it('gives none for a file', async () => {
    const ws = await workspace();
    await writeFile(path.join(ws, 'file.txt'), 'x\n');
    expect(await detectRepositories(runner, path.join(ws, 'file.txt'))).toEqual({ status: 'none' });
  });

  it('gives none when git is not installed', async () => {
    const ws = await workspace();
    await repoAt(ws, 'api');
    expect(await detectRepositories(new GitRunner(path.join(dir, 'no-such-git')), ws)).toEqual({ status: 'none' });
  });
});

describe('detectRepositories: git errors', () => {
  // plan-multi_repo_workspace/REQ-9
  it('gives the git message on a repository git cannot read, and keeps the others', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    const app = path.join(ws, 'web', 'app');
    await mkdir(app, { recursive: true });
    await writeFile(path.join(app, '.git'), `gitdir: ${path.join(dir, 'missing-gitdir')}\n`);
    const result = await detectRepositories(runner, ws);
    expect(result.status).toBe('repositories');
    if (result.status !== 'repositories') return;
    expect(result.repositories.map((r) => r.path)).toEqual(['api', 'web/app']);
    expect(result.repositories[0]).toEqual({ root: api, name: 'api', path: 'api', branch: main });
    const broken = result.repositories[1]!;
    expect(broken).toMatchObject({ root: app, name: 'app', path: 'web/app' });
    expect('branch' in broken).toBe(false);
    expect('error' in broken && broken.error.length > 0).toBe(true);
  });

  it('gives "Not a valid git repository." for a .git that git does not accept inside another repository', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    const fake = path.join(api, 'fake');
    await mkdir(path.join(fake, '.git'), { recursive: true });
    const result = await detectRepositories(runner, ws);
    expect(result).toEqual({
      status: 'repositories',
      repositories: [
        { root: api, name: 'api', path: 'api', branch: main },
        { root: fake, name: 'fake', path: 'api/fake', error: 'Not a valid git repository.' },
      ],
    });
  });

  it('gives the folder itself with the error when the lookup of the folder fails with another git error', async () => {
    const ws = await workspace();
    const failing: Runner = { run: () => Promise.reject(new GitError('failed', 'fatal: bad object HEAD', 128)) };
    expect(await detectRepositories(failing, ws)).toEqual({
      status: 'repositories',
      repositories: [{ root: ws, name: path.basename(ws), path: '.', error: 'fatal: bad object HEAD' }],
    });
  });
});

describe('detectRepositories: rules', () => {
  // plan-multi_repo_workspace/REQ-10
  it('searches again at each call', async () => {
    const ws = await workspace();
    await repoAt(ws, 'api');
    expect(await detectedPaths(ws)).toEqual(['api']);
    await repoAt(ws, 'tools');
    expect(await detectedPaths(ws)).toEqual(['api', 'tools']);
    await rm(path.join(ws, 'api'), { recursive: true, force: true });
    expect(await detectedPaths(ws)).toEqual(['tools']);
  });

  it('runs only rev-parse, symbolic-ref and ls-files', async () => {
    const ws = await workspace();
    const api = await repoAt(ws, 'api');
    await repoAt(ws, 'web/app');
    const source = await repoAt(dir, `submodule-source-${count}`);
    git(api, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'libs/sub');
    const commands = new Set<string>();
    const recording: Runner = { run: (folder, args, options) => (commands.add(args[0] ?? ''), runner.run(folder, args, options)) };
    await detectRepositories(recording, ws);
    expect([...commands].every((c) => ['rev-parse', 'symbolic-ref', 'ls-files'].includes(c)), [...commands].join(', ')).toBe(true);
  });

  // plan-multi_repo_workspace/REQ-12
  it('runs at most 4 branch lookups at the same time', async () => {
    const ws = await workspace();
    for (let i = 0; i < 10; i += 1) await repoAt(ws, `repo-${i}`);
    let running = 0;
    let most = 0;
    const slow: Runner = {
      run: async (folder, args, options) => {
        if (args[0] !== 'symbolic-ref') return runner.run(folder, args, options);
        running += 1;
        most = Math.max(most, running);
        try {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return await runner.run(folder, args, options);
        } finally {
          running -= 1;
        }
      },
    };
    const result = await detectRepositories(slow, ws);
    expect(result.status === 'repositories' && result.repositories.length).toBe(10);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(4);
  });

  // plan-multi_repo_workspace/REQ-12
  it('gives control back to the event loop while it walks a large folder', async () => {
    const ws = await workspace();
    const folders: string[] = [];
    for (let a = 0; a < 12; a += 1) for (let b = 0; b < 12; b += 1) for (let c = 0; c < 12; c += 1) folders.push(path.join(ws, `a${a}`, `b${b}`, `c${c}`));
    await Promise.all(folders.map((f) => mkdir(f, { recursive: true })));
    await repoAt(ws, 'a3/b4/c5/repo');
    let last = performance.now();
    let longest = 0;
    let ticks = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
      ticks += 1;
    }, 5);
    try {
      expect(await detectedPaths(ws)).toEqual(['a3/b4/c5/repo']);
    } finally {
      clearInterval(timer);
    }
    expect(ticks).toBeGreaterThan(0);
    expect(longest, `longest event-loop pause ${Math.round(longest)} ms`).toBeLessThan(500);
  }, 30_000);
});
