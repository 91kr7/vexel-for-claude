import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../test-support.js';
import { ProjectMarkStore } from './project-mark-store.js';

let dir: string;
const marksFile = () => path.join(dir, 'project-marks.json');
const saved = async (file = marksFile()) => JSON.parse(await readFile(file, 'utf8')) as unknown;

beforeEach(async () => {
  dir = await tempDir('ai-client-project-marks-');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ProjectMarkStore.load', () => {
  it('reads the favorites of <dataDir>/project-marks.json', async () => {
    await writeFile(marksFile(), JSON.stringify({ favorites: ['/work/a', '/work/b'] }));
    const store = await ProjectMarkStore.load(dir);
    expect(store.isFavorite('/work/a')).toBe(true);
    expect(store.isFavorite('/work/b')).toBe(true);
    expect(store.isFavorite('/work/c')).toBe(false);
    expect(store.favorites().sort()).toEqual(['/work/a', '/work/b']);
  });

  it.each([
    ['a missing file', undefined],
    ['invalid JSON', '{ not json'],
    ['a value that is not an object', '["/work/a"]'],
    ['null', 'null'],
    ['favorites that is not an array', '{ "favorites": "/work/a" }'],
  ])('gives no favorites for %s, without failing', async (_name, content) => {
    if (content !== undefined) await writeFile(marksFile(), content);
    const store = await ProjectMarkStore.load(dir);
    expect(store.favorites()).toEqual([]);
  });

  it('ignores entries of favorites that are not strings', async () => {
    await writeFile(marksFile(), JSON.stringify({ favorites: ['/work/a', 3, null, { folder: '/work/b' }, true] }));
    const store = await ProjectMarkStore.load(dir);
    expect(store.favorites()).toEqual(['/work/a']);
  });

  it('writes nothing, even when the data folder is missing', async () => {
    const missing = path.join(dir, 'not-yet');
    await ProjectMarkStore.load(missing);
    expect(await readdir(dir)).toEqual([]);
  });
});

describe('ProjectMarkStore.setFavorite', () => {
  // plan-project_list_actions/REQ-28: the file holds every marked folder
  it('saves { favorites: [...] } with every marked folder, and the promise resolves once the file is saved', async () => {
    const store = await ProjectMarkStore.load(dir);
    await store.setFavorite('/work/a', true);
    expect(await saved()).toEqual({ favorites: ['/work/a'] });
    await store.setFavorite('/work/b', true);
    expect(((await saved()) as { favorites: string[] }).favorites.sort()).toEqual(['/work/a', '/work/b']);
  });

  it('clears the mark and saves the file without the folder', async () => {
    await writeFile(marksFile(), JSON.stringify({ favorites: ['/work/a', '/work/b'] }));
    const store = await ProjectMarkStore.load(dir);
    await store.setFavorite('/work/a', false);
    expect(store.isFavorite('/work/a')).toBe(false);
    expect(await saved()).toEqual({ favorites: ['/work/b'] });
  });

  // plan-project_list_actions/REQ-28: a new store on the same folder finds the marks (client restart)
  it('a store loaded again from the same data folder has the saved marks', async () => {
    const first = await ProjectMarkStore.load(dir);
    await first.setFavorite('/work/a', true);
    await first.setFavorite('/work/b', true);
    await first.setFavorite('/work/b', false);
    const second = await ProjectMarkStore.load(dir);
    expect(second.favorites()).toEqual(['/work/a']);
  });

  it('creates the data folder when it is missing', async () => {
    const nested = path.join(dir, 'deep', 'data');
    const store = await ProjectMarkStore.load(nested);
    await store.setFavorite('/work/a', true);
    expect(await saved(path.join(nested, 'project-marks.json'))).toEqual({ favorites: ['/work/a'] });
  });

  it('leaves no temporary file next to the saved one', async () => {
    const store = await ProjectMarkStore.load(dir);
    await store.setFavorite('/work/a', true);
    await store.setFavorite('/work/b', true);
    expect(await readdir(dir)).toEqual(['project-marks.json']);
  });

  it('runs the saves one after the other: the file ends with the last state', async () => {
    const store = await ProjectMarkStore.load(dir);
    const calls: Promise<void>[] = [];
    for (let i = 0; i < 20; i += 1) calls.push(store.setFavorite(`/work/p${i}`, true));
    for (let i = 0; i < 20; i += 2) calls.push(store.setFavorite(`/work/p${i}`, false));
    await Promise.all(calls);
    const expected = Array.from({ length: 10 }, (_, i) => `/work/p${2 * i + 1}`).sort();
    expect(((await saved()) as { favorites: string[] }).favorites.sort()).toEqual(expected);
    expect(store.favorites().sort()).toEqual(expected);
  });

  it('lists a folder once, even when it is marked twice', async () => {
    const store = await ProjectMarkStore.load(dir);
    await store.setFavorite('/work/a', true);
    await store.setFavorite('/work/a', true);
    expect(store.favorites()).toEqual(['/work/a']);
    expect(await saved()).toEqual({ favorites: ['/work/a'] });
  });

  it('with the same value as now changes nothing, calls no listener and writes nothing', async () => {
    const store = await ProjectMarkStore.load(dir);
    const listener = vi.fn();
    store.onChange(listener);
    await store.setFavorite('/work/a', false);
    expect(listener).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([]);

    await store.setFavorite('/work/a', true);
    listener.mockClear();
    await writeFile(marksFile(), 'sentinel');
    await store.setFavorite('/work/a', true);
    expect(listener).not.toHaveBeenCalled();
    expect(await readFile(marksFile(), 'utf8')).toBe('sentinel');
  });

  it('calls the listeners before the call returns', async () => {
    const store = await ProjectMarkStore.load(dir);
    const seen: boolean[] = [];
    store.onChange(() => seen.push(store.isFavorite('/work/a')));
    const call = store.setFavorite('/work/a', true);
    expect(seen).toEqual([true]);
    await call;
    const removal = store.setFavorite('/work/a', false);
    expect(seen).toEqual([true, false]);
    await removal;
  });

  it('stops calling a listener once it unsubscribes', async () => {
    const store = await ProjectMarkStore.load(dir);
    const listener = vi.fn();
    const unsubscribe = store.onChange(listener);
    await store.setFavorite('/work/a', true);
    unsubscribe();
    await store.setFavorite('/work/b', true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('compares the folder as given: a trailing slash is another folder', async () => {
    const store = await ProjectMarkStore.load(dir);
    await store.setFavorite('/work/a', true);
    expect(store.isFavorite('/work/a/')).toBe(false);
    expect(store.isFavorite('/Work/a')).toBe(false);
  });

  // plan-project_list_actions/REQ-27: the store never checks the disk
  it('marks a folder that does not exist on disk', async () => {
    const store = await ProjectMarkStore.load(dir);
    const missing = path.join(dir, 'gone', 'project');
    await store.setFavorite(missing, true);
    expect(store.isFavorite(missing)).toBe(true);
  });
});

describe('new ProjectMarkStore', () => {
  it('starts with the given favorites and, with no file, saves nothing', async () => {
    const store = new ProjectMarkStore(undefined, ['/work/a']);
    expect(store.isFavorite('/work/a')).toBe(true);
    await store.setFavorite('/work/b', true);
    expect(store.favorites().sort()).toEqual(['/work/a', '/work/b']);
    expect(await readdir(dir)).toEqual([]);
  });

  it('with a file, saves there', async () => {
    const file = path.join(dir, 'custom.json');
    await mkdir(dir, { recursive: true });
    const store = new ProjectMarkStore(file);
    await store.setFavorite('/work/a', true);
    expect(await saved(file)).toEqual({ favorites: ['/work/a'] });
  });
});
