// Tests of plan-remote_notifications, batch notifications-section: RemoteSettingsStore spec.
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_REMOTE_SETTINGS, parseRemoteSettings, RemoteSettingsStore } from './remote-settings-store.js';

const DEFAULTS = { enabled: false, topicUrl: '', token: '' };
const SET = { enabled: true, topicUrl: 'https://ntfy.sh/my-topic', token: 'tk_secret' };

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'remote-settings-'));
  file = path.join(dir, 'remote-notifications.json');
});

afterEach(async () => {
  await chmod(dir, 0o700).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
});

const mode = async (filePath: string) => (await stat(filePath)).mode & 0o777;

describe('parseRemoteSettings', () => {
  it('gives the three fields of a well-formed object, and only them', () => {
    const parsed = parseRemoteSettings({ ...SET, extra: 1 });
    expect(parsed).toEqual(SET);
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['enabled', 'token', 'topicUrl']);
  });

  it.each([
    ['null', null],
    ['a string', 'text'],
    ['a number', 3],
    ['an array', []],
    ['a missing enabled', { topicUrl: '', token: '' }],
    ['a missing topicUrl', { enabled: false, token: '' }],
    ['a missing token', { enabled: false, topicUrl: '' }],
    ['a string enabled', { enabled: 'true', topicUrl: '', token: '' }],
    ['a number topicUrl', { enabled: true, topicUrl: 1, token: '' }],
    ['a null token', { enabled: true, topicUrl: '', token: null }],
  ])('gives undefined for %s', (_name, value) => {
    expect(parseRemoteSettings(value)).toBeUndefined();
  });
});

describe('RemoteSettingsStore', () => {
  // plan-remote_notifications/REQ-5: nothing saved → switch off, empty URL and token
  it('has the defaults off, empty URL, empty token', () => {
    expect(DEFAULT_REMOTE_SETTINGS).toEqual(DEFAULTS);
  });

  it('does not touch the file when it is created', async () => {
    new RemoteSettingsStore(file);
    await expect(stat(file)).rejects.toThrow();
  });

  it('reads the defaults when there is no file', async () => {
    expect(await new RemoteSettingsStore(file).read()).toEqual(DEFAULTS);
  });

  it.each([
    ['bad JSON', '{ enabled: true'],
    ['a bad shape', JSON.stringify({ enabled: 'yes', topicUrl: 'https://ntfy.sh/a', token: '' })],
    ['JSON null', 'null'],
  ])('reads the defaults from a file with %s', async (_name, content) => {
    await writeFile(file, content);
    expect(await new RemoteSettingsStore(file).read()).toEqual(DEFAULTS);
  });

  it('reads the defaults, without rejecting, when the path cannot be read as a file', async () => {
    await mkdir(file);
    expect(await new RemoteSettingsStore(file).read()).toEqual(DEFAULTS);
  });

  // plan-remote_notifications/REQ-12: the values survive a restart (a new store of the same file)
  it('reads back what it saved, also in a new store of the same file', async () => {
    const store = new RemoteSettingsStore(file);
    await store.save(SET);
    expect(await store.read()).toEqual(SET);
    expect(await new RemoteSettingsStore(file).read()).toEqual(SET);
  });

  it('writes the three fields as JSON, and only them', async () => {
    await new RemoteSettingsStore(file).save({ ...SET, extra: 'x' } as typeof SET);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(SET);
  });

  it('keeps any topic URL string, a bad one too', async () => {
    const bad = { enabled: true, topicUrl: 'ftp://not valid', token: '' };
    const store = new RemoteSettingsStore(file);
    await store.save(bad);
    expect(await store.read()).toEqual(bad);
  });

  it('creates its folder when it is missing', async () => {
    const nested = path.join(dir, 'a', 'b', 'remote-notifications.json');
    const store = new RemoteSettingsStore(nested);
    await store.save(SET);
    expect(await new RemoteSettingsStore(nested).read()).toEqual(SET);
  });

  it('leaves the file with mode 0600', async () => {
    await new RemoteSettingsStore(file).save(SET);
    expect(await mode(file)).toBe(0o600);
  });

  it('gives mode 0600 to a file that existed with another mode', async () => {
    await writeFile(file, JSON.stringify(DEFAULTS), { mode: 0o644 });
    await chmod(file, 0o644);
    expect(await mode(file)).toBe(0o644);
    await new RemoteSettingsStore(file).save(SET);
    expect(await mode(file)).toBe(0o600);
  });

  it('runs quick saves in call order: the file ends with the last one, as valid JSON', async () => {
    const store = new RemoteSettingsStore(file);
    const saves = Array.from({ length: 20 }, (_, index) => store.save({ enabled: index % 2 === 0, topicUrl: `https://ntfy.sh/t${index}`, token: 'x'.repeat(index * 50) }));
    await Promise.all(saves);
    const last = { enabled: false, topicUrl: 'https://ntfy.sh/t19', token: 'x'.repeat(19 * 50) };
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(last);
    expect(await new RemoteSettingsStore(file).read()).toEqual(last);
  });

  it.skipIf(process.getuid?.() === 0)('rejects a failed write, and a later save still runs', async () => {
    const folder = path.join(dir, 'locked');
    await mkdir(folder);
    const target = path.join(folder, 'remote-notifications.json');
    const store = new RemoteSettingsStore(target);
    await chmod(folder, 0o500);
    await expect(store.save(SET)).rejects.toThrow();
    await chmod(folder, 0o700);
    await store.save(SET);
    expect(await store.read()).toEqual(SET);
  });
});
