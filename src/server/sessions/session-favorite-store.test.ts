import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { SessionFavoriteStore } from './session-favorite-store.js';

const FILE_NAME = 'session-favorites.json';
const dirs: string[] = [];

async function dataDir(): Promise<string> {
  const dir = await tempDir('ai-client-favorites-');
  dirs.push(dir);
  return dir;
}

const fileIn = (dir: string) => path.join(dir, FILE_NAME);
const saved = async (dir: string) => JSON.parse(await readFile(fileIn(dir), 'utf8')) as Record<string, unknown>;
const exists = (file: string) => readFile(file).then(() => true, () => false);

function record(store: SessionFavoriteStore): [string, boolean][] {
  const changes: [string, boolean][] = [];
  store.onChange((key, favorite) => changes.push([key, favorite]));
  return changes;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('SessionFavoriteStore.load', () => {
  // plan-favorite_session/REQ-6: the marks come back from the file
  it('reads the keys saved in <dataDir>/session-favorites.json', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), JSON.stringify({ a: true, b: true }));
    const store = await SessionFavoriteStore.load(dir);
    expect(store.has('a')).toBe(true);
    expect(store.has('b')).toBe(true);
    expect(store.has('c')).toBe(false);
  });

  it('starts with no favorites when the file is missing, and writes nothing', async () => {
    const dir = await dataDir();
    const store = await SessionFavoriteStore.load(dir);
    expect(store.has('a')).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });

  it.each([
    ['invalid JSON', '{ not json'],
    ['an array', '["a"]'],
    ['a string', '"a"'],
    ['null', 'null'],
    ['a number', '3'],
  ])('starts with no favorites, and does not fail, when the file holds %s', async (_, content) => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), content);
    const store = await SessionFavoriteStore.load(dir);
    expect(store.has('a')).toBe(false);
    expect(store.has('0')).toBe(false);
  });

  it('ignores the entries whose value is not true', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), JSON.stringify({ yes: true, no: false, text: 'true', one: 1, nothing: null }));
    const store = await SessionFavoriteStore.load(dir);
    expect(['yes', 'no', 'text', 'one', 'nothing'].filter((key) => store.has(key))).toEqual(['yes']);
  });
});

describe('SessionFavoriteStore.set', () => {
  it('marks a key and tells the listeners before the promise resolves', async () => {
    const store = new SessionFavoriteStore();
    const changes = record(store);
    const done = store.set('a', true);
    expect(changes).toEqual([['a', true]]);
    expect(store.has('a')).toBe(true);
    await done;
  });

  // plan-favorite_session/REQ-5: removing the mark
  it('clears the mark and tells the listeners', async () => {
    const store = new SessionFavoriteStore(undefined, ['a']);
    const changes = record(store);
    await store.set('a', false);
    expect(store.has('a')).toBe(false);
    expect(changes).toEqual([['a', false]]);
  });

  it('changes nothing, calls no listener and writes nothing when the value is the same', async () => {
    const dir = await dataDir();
    const store = new SessionFavoriteStore(fileIn(dir), ['a']);
    const changes = record(store);
    await store.set('a', true);
    await store.set('b', false);
    expect(changes).toEqual([]);
    expect(await exists(fileIn(dir))).toBe(false);
  });

  // plan-favorite_session/REQ-6: saved as { key: true }, and a new store reads it back
  it('saves every marked key as { "<key>": true } and a new load reads it back', async () => {
    const dir = await dataDir();
    const store = await SessionFavoriteStore.load(dir);
    await store.set('a', true);
    await store.set('b', true);
    await store.set('a', false);
    expect(await saved(dir)).toEqual({ b: true });
    const again = await SessionFavoriteStore.load(dir);
    expect(again.has('a')).toBe(false);
    expect(again.has('b')).toBe(true);
  });

  it('creates the folder when it is missing, and leaves no temporary file', async () => {
    const dir = await dataDir();
    const nested = path.join(dir, 'deep', 'data');
    const store = await SessionFavoriteStore.load(nested);
    await store.set('a', true);
    expect(await readdir(nested)).toEqual([FILE_NAME]);
  });

  it('keeps the last value when saves are started one after the other', async () => {
    const dir = await dataDir();
    const store = await SessionFavoriteStore.load(dir);
    const saves = [store.set('a', true), store.set('b', true), store.set('a', false), store.set('c', true)];
    await Promise.all(saves);
    expect(await saved(dir)).toEqual({ b: true, c: true });
  });

  it('does not stop later saves after one save failed', async () => {
    const dir = await dataDir();
    const blocker = path.join(dir, 'blocked');
    await writeFile(blocker, 'a file, not a folder');
    const store = new SessionFavoriteStore(path.join(blocker, FILE_NAME));
    await expect(store.set('a', true)).rejects.toBeDefined();
    await rm(blocker);
    await store.set('b', true);
    expect(await saved(blocker)).toEqual({ a: true, b: true });
  });
});

describe('SessionFavoriteStore.move', () => {
  // plan-favorite_session/REQ-7: the mark follows the key of the conversation
  it('moves the mark and notifies (from, false) and then (to, true)', async () => {
    const store = new SessionFavoriteStore(undefined, ['hosted-1']);
    const changes = record(store);
    await store.move('hosted-1', 'claude-1');
    expect(store.has('hosted-1')).toBe(false);
    expect(store.has('claude-1')).toBe(true);
    expect(changes).toEqual([['hosted-1', false], ['claude-1', true]]);
  });

  it('saves the moved key', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), JSON.stringify({ 'hosted-1': true }));
    const store = await SessionFavoriteStore.load(dir);
    await store.move('hosted-1', 'claude-1');
    expect(await saved(dir)).toEqual({ 'claude-1': true });
  });

  it('changes nothing when from has no mark', async () => {
    const store = new SessionFavoriteStore(undefined, ['other']);
    const changes = record(store);
    await store.move('a', 'b');
    expect(store.has('b')).toBe(false);
    expect(store.has('other')).toBe(true);
    expect(changes).toEqual([]);
  });

  it('changes nothing when from and to are the same key', async () => {
    const store = new SessionFavoriteStore(undefined, ['a']);
    const changes = record(store);
    await store.move('a', 'a');
    expect(store.has('a')).toBe(true);
    expect(changes).toEqual([]);
  });

  it('keeps the target marked when it already was, and notifies only the removal of from', async () => {
    const store = new SessionFavoriteStore(undefined, ['a', 'b']);
    const changes = record(store);
    await store.move('a', 'b');
    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(true);
    expect(changes).toEqual([['a', false]]);
  });
});

describe('SessionFavoriteStore.onChange', () => {
  it('stops calling a listener after it unsubscribed', async () => {
    const store = new SessionFavoriteStore();
    const changes: [string, boolean][] = [];
    const unsubscribe = store.onChange((key, favorite) => changes.push([key, favorite]));
    await store.set('a', true);
    unsubscribe();
    await store.set('a', false);
    expect(changes).toEqual([['a', true]]);
  });
});
