import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../test-support.js';
import { NAME_MAX_LENGTH, NameTooLongError, SessionNameStore, dataDirOf, nameLength } from './session-name-store.js';

const FILE_NAME = 'session-names.json';
const dirs: string[] = [];

async function dataDir(): Promise<string> {
  const dir = await tempDir('ai-client-names-');
  dirs.push(dir);
  return dir;
}

const fileIn = (dir: string) => path.join(dir, FILE_NAME);
const savedNames = async (dir: string) => JSON.parse(await readFile(fileIn(dir), 'utf8')) as Record<string, string>;
const exists = (file: string) => readFile(file).then(() => true, () => false);

function record(store: SessionNameStore): [string, string | undefined][] {
  const changes: [string, string | undefined][] = [];
  store.onChange((key, name) => changes.push([key, name]));
  return changes;
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('dataDirOf', () => {
  it('is AI_CLIENT_DATA_DIR when set and not empty', () => {
    expect(dataDirOf({ AI_CLIENT_DATA_DIR: '/data/names', XDG_DATA_HOME: '/xdg' })).toBe('/data/names');
  });

  it('is <XDG_DATA_HOME>/ai-client when AI_CLIENT_DATA_DIR is empty or missing', () => {
    expect(dataDirOf({ AI_CLIENT_DATA_DIR: '', XDG_DATA_HOME: '/xdg' })).toBe('/xdg/ai-client');
    expect(dataDirOf({ XDG_DATA_HOME: '/xdg' })).toBe('/xdg/ai-client');
  });

  it('defaults XDG_DATA_HOME to ~/.local/share', () => {
    expect(dataDirOf({})).toBe(path.join(os.homedir(), '.local', 'share', 'ai-client'));
  });
});

describe('nameLength', () => {
  it('counts Unicode code points, not UTF-16 units', () => {
    expect(NAME_MAX_LENGTH).toBe(200);
    expect(nameLength('abc')).toBe(3);
    expect(nameLength('😀😀')).toBe(2);
  });
});

describe('SessionNameStore.load', () => {
  it('reads the names saved in <dataDir>/session-names.json', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), JSON.stringify({ a: 'Release fix', b: 'Nightly build' }));
    const store = await SessionNameStore.load(dir);
    expect(store.get('a')).toBe('Release fix');
    expect(store.get('b')).toBe('Nightly build');
    expect(store.get('c')).toBeUndefined();
  });

  it.each([
    ['invalid JSON', '{ not json'],
    ['an array', '["a", "b"]'],
    ['a string', '"a"'],
    ['null', 'null'],
  ])('gives no names and never fails for %s', async (_, content) => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), content);
    const store = await SessionNameStore.load(dir);
    expect(store.get('0')).toBeUndefined();
    expect(store.get('a')).toBeUndefined();
  });

  it('ignores entries whose value is not a non-empty string', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), JSON.stringify({ ok: 'Kept', empty: '', number: 3, nested: { a: 'b' }, nothing: null }));
    const store = await SessionNameStore.load(dir);
    expect(store.get('ok')).toBe('Kept');
    for (const key of ['empty', 'number', 'nested', 'nothing']) expect(store.get(key), key).toBeUndefined();
  });

  it('writes nothing: a missing file and a missing folder stay missing', async () => {
    const dir = path.join(await dataDir(), 'not-yet');
    const store = await SessionNameStore.load(dir);
    expect(store.get('a')).toBeUndefined();
    expect(await exists(dir)).toBe(false);
  });

  it('leaves an invalid file as it is', async () => {
    const dir = await dataDir();
    await writeFile(fileIn(dir), '{ not json');
    await SessionNameStore.load(dir);
    expect(await readFile(fileIn(dir), 'utf8')).toBe('{ not json');
  });
});

describe('SessionNameStore.set', () => {
  // plan-session_list_improvements/REQ-32
  it('trims the name at both ends, saves it and tells the listeners', async () => {
    const dir = await dataDir();
    const store = await SessionNameStore.load(dir);
    const changes = record(store);
    await store.set('a', '  Release fix \t');
    expect(store.get('a')).toBe('Release fix');
    expect(changes).toEqual([['a', 'Release fix']]);
    expect(await savedNames(dir)).toEqual({ a: 'Release fix' });
  });

  it('calls the listeners before the call returns', async () => {
    const store = new SessionNameStore();
    const changes = record(store);
    const pending = store.set('a', 'Release fix');
    expect(changes).toEqual([['a', 'Release fix']]);
    await pending;
  });

  // plan-session_list_improvements/REQ-31
  it.each([[''], ['   '], ['\t \n']])('removes the name for %j and tells the listeners with undefined', async (empty) => {
    const dir = await dataDir();
    const store = await SessionNameStore.load(dir);
    await store.set('a', 'Release fix');
    await store.set('b', 'Other');
    const changes = record(store);
    await store.set('a', empty);
    expect(store.get('a')).toBeUndefined();
    expect(changes).toEqual([['a', undefined]]);
    expect(await savedNames(dir)).toEqual({ b: 'Other' });
  });

  // plan-session_list_improvements/REQ-33
  it('rejects a trimmed name over 200 characters with NameTooLongError, and nothing changes', async () => {
    const dir = await dataDir();
    const store = await SessionNameStore.load(dir);
    await store.set('a', 'Release fix');
    const before = await readFile(fileIn(dir), 'utf8');
    const changes = record(store);

    await expect(store.set('a', 'x'.repeat(201))).rejects.toBeInstanceOf(NameTooLongError);
    await expect(store.set('b', '😀'.repeat(201))).rejects.toBeInstanceOf(NameTooLongError);

    expect(store.get('a')).toBe('Release fix');
    expect(store.get('b')).toBeUndefined();
    expect(changes).toEqual([]);
    expect(await readFile(fileIn(dir), 'utf8')).toBe(before);
  });

  // plan-session_list_improvements/REQ-32, REQ-33: the limit applies after the trim, in characters
  it('accepts 200 characters after the trim, emoji counted once', async () => {
    const store = new SessionNameStore();
    await store.set('a', `   ${'x'.repeat(200)}   `);
    await store.set('b', '😀'.repeat(200));
    expect(store.get('a')).toBe('x'.repeat(200));
    expect(store.get('b')).toBe('😀'.repeat(200));
  });

  it('changes nothing, calls no listener and writes nothing for the same name', async () => {
    const dir = await dataDir();
    const store = new SessionNameStore(fileIn(dir), [['a', 'Release fix']]);
    const changes = record(store);
    await store.set('a', ' Release fix ');
    await store.set('b', '   ');
    expect(changes).toEqual([]);
    expect(await exists(fileIn(dir))).toBe(false);
  });

  it('saves nothing when the store has no file', async () => {
    const store = new SessionNameStore(undefined, [['a', 'Old']]);
    await store.set('a', 'New');
    expect(store.get('a')).toBe('New');
  });

  it('creates the data folder when missing', async () => {
    const dir = path.join(await dataDir(), 'nested', 'ai-client');
    const store = await SessionNameStore.load(dir);
    await store.set('a', 'Release fix');
    expect(await savedNames(dir)).toEqual({ a: 'Release fix' });
  });

  it('saves one after the other: concurrent changes all reach the file, with no temporary file left', async () => {
    const dir = await dataDir();
    const store = await SessionNameStore.load(dir);
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.set(`k${i}`, `Name ${i}`)));
    await store.set('k3', '');
    const expected = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, `Name ${i}`]).filter(([key]) => key !== 'k3'));
    expect(await savedNames(dir)).toEqual(expected);
    expect(await readdir(dir)).toEqual([FILE_NAME]);
  });

  // plan-session_list_improvements/REQ-35: the names survive a restart
  it('gives the saved names to a store loaded again from the same folder', async () => {
    const dir = await dataDir();
    const first = await SessionNameStore.load(dir);
    await first.set('a', 'Release fix');
    await first.set('b', 'Gone');
    await first.set('b', '');
    const second = await SessionNameStore.load(dir);
    expect(second.get('a')).toBe('Release fix');
    expect(second.get('b')).toBeUndefined();
  });
});

describe('SessionNameStore.move', () => {
  it('moves the name from one key to the other, with listeners (from, undefined) then (to, name), and saves', async () => {
    const dir = await dataDir();
    const store = await SessionNameStore.load(dir);
    await store.set('hosted', 'Release fix');
    const changes = record(store);
    await store.move('hosted', 'claude');
    expect(store.get('hosted')).toBeUndefined();
    expect(store.get('claude')).toBe('Release fix');
    expect(changes).toEqual([
      ['hosted', undefined],
      ['claude', 'Release fix'],
    ]);
    expect(await savedNames(dir)).toEqual({ claude: 'Release fix' });
  });

  it('replaces an old name of the target key', async () => {
    const store = new SessionNameStore(undefined, [
      ['from', 'New name'],
      ['to', 'Old name'],
    ]);
    await store.move('from', 'to');
    expect(store.get('to')).toBe('New name');
    expect(store.get('from')).toBeUndefined();
  });

  it('changes nothing when the source has no name, or both keys are the same', async () => {
    const dir = await dataDir();
    const store = new SessionNameStore(fileIn(dir), [['to', 'Kept']]);
    const changes = record(store);
    await store.move('nobody', 'to');
    await store.move('to', 'to');
    expect(store.get('to')).toBe('Kept');
    expect(changes).toEqual([]);
    expect(await exists(fileIn(dir))).toBe(false);
  });
});

describe('SessionNameStore.onChange', () => {
  it('stops calling a listener after unsubscribe', async () => {
    const store = new SessionNameStore();
    const changes: string[] = [];
    const unsubscribe = store.onChange((key) => changes.push(key));
    await store.set('a', 'One');
    unsubscribe();
    await store.set('b', 'Two');
    expect(changes).toEqual(['a']);
  });
});
