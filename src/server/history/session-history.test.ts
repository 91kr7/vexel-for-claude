import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshotTree, tempDir, userEntry, writeHistorySession } from '../test-support.js';
import { SessionHistory, defaultClaudeDir } from './session-history.js';

let claudeDir: string;
let history: SessionHistory;

const at = (iso: string) => new Date(iso);

/** A session whose only user entry is `entry`, after an entry that sets the folder. */
const firstMessageOf = async (id: string, ...entries: (object | string)[]) => {
  await writeHistorySession(claudeDir, 'p', id, [{ type: 'system', cwd: '/work/p' }, ...entries]);
  return (await history.get(id))?.firstUserMessage;
};

beforeEach(async () => {
  claudeDir = await tempDir('ai-client-claude-');
  history = new SessionHistory({ claudeDir });
});

describe('SessionHistory.list', () => {
  // plan-claude_sessions_client/REQ-25, REQ-26
  it('gives one entry per projects/<project>/<id>.jsonl, the most recently changed first', async () => {
    await writeHistorySession(claudeDir, '-work-a', 'old', [userEntry('Primo', '/work/a')], at('2026-11-01T10:00:00Z'));
    await writeHistorySession(claudeDir, '-work-b', 'new', [userEntry('Terzo', '/work/b')], at('2026-11-03T10:00:00Z'));
    await writeHistorySession(claudeDir, '-work-a', 'mid', [userEntry('Secondo', '/work/a')], at('2026-11-02T10:00:00Z'));

    expect(await history.list()).toEqual([
      { id: 'new', folder: '/work/b', firstUserMessage: 'Terzo', lastModified: at('2026-11-03T10:00:00Z') },
      { id: 'mid', folder: '/work/a', firstUserMessage: 'Secondo', lastModified: at('2026-11-02T10:00:00Z') },
      { id: 'old', folder: '/work/a', firstUserMessage: 'Primo', lastModified: at('2026-11-01T10:00:00Z') },
    ]);
  });

  it('does not treat files deeper in the tree as sessions', async () => {
    await writeHistorySession(claudeDir, 'p', 'main', [userEntry('Ciao', '/work/p')]);
    await writeHistorySession(claudeDir, path.join('p', 'main', 'subagents'), 'agent-1', [userEntry('Sub', '/work/p')]);
    expect((await history.list()).map((s) => s.id)).toEqual(['main']);
  });

  it('is empty when there is no projects folder', async () => {
    expect(await history.list()).toEqual([]);
  });

  it('skips a file that cannot be read', async () => {
    await writeHistorySession(claudeDir, 'p', 'readable', [userEntry('Ciao', '/work/p')]);
    const locked = await writeHistorySession(claudeDir, 'p', 'locked', [userEntry('Segreto', '/work/p')]);
    await chmod(locked, 0o000);
    try {
      expect((await history.list()).map((s) => s.id)).toEqual(['readable']);
    } finally {
      await chmod(locked, 0o644);
    }
  });

  it('skips a project folder that cannot be read', async () => {
    await writeHistorySession(claudeDir, 'open', 'visible', [userEntry('Ciao', '/work/open')]);
    await writeHistorySession(claudeDir, 'closed', 'hidden', [userEntry('Ciao', '/work/closed')]);
    const closed = path.join(claudeDir, 'projects', 'closed');
    await chmod(closed, 0o000);
    try {
      expect((await history.list()).map((s) => s.id)).toEqual(['visible']);
    } finally {
      await chmod(closed, 0o755);
    }
  });
});

describe('SessionHistory.get', () => {
  it('gives the session with that id', async () => {
    await writeHistorySession(claudeDir, 'p', 'abc-123_X', [userEntry('Ciao', '/work/p')], at('2026-11-04T08:00:00Z'));
    expect(await history.get('abc-123_X')).toEqual({
      id: 'abc-123_X',
      folder: '/work/p',
      firstUserMessage: 'Ciao',
      lastModified: at('2026-11-04T08:00:00Z'),
    });
  });

  it('gives undefined for an unknown id', async () => {
    await writeHistorySession(claudeDir, 'p', 'known', [userEntry('Ciao', '/work/p')]);
    expect(await history.get('unknown')).toBeUndefined();
  });

  // The file exists, so only the id check can reject it.
  it.each(['a.b', '../p/known', 'a b', ''])('gives undefined for the id %j, with characters other than letters, digits, - and _', async (id) => {
    await writeHistorySession(claudeDir, 'p', 'known', [userEntry('Ciao', '/work/p')]);
    await writeHistorySession(claudeDir, 'p', 'a.b', [userEntry('Ciao', '/work/p')]);
    await writeHistorySession(claudeDir, 'p', 'a b', [userEntry('Ciao', '/work/p')]);
    expect(await history.get(id)).toBeUndefined();
  });
});

describe('SessionHistory folder', () => {
  it('is the cwd of the first entry that has one', async () => {
    await writeHistorySession(claudeDir, 'p', 's', [{ type: 'summary' }, { type: 'system', cwd: '/work/first' }, userEntry('Ciao', '/work/second')]);
    expect((await history.get('s'))?.folder).toBe('/work/first');
  });

  it('is null when no entry has a cwd', async () => {
    await writeHistorySession(claudeDir, 'p', 's', [userEntry('Ciao')]);
    expect((await history.get('s'))?.folder).toBeNull();
  });
});

describe('SessionHistory first user message', () => {
  it('is the trimmed string content of the first user entry', async () => {
    expect(await firstMessageOf('s', userEntry('  Correggi il bug \n'), userEntry('Secondo'))).toBe('Correggi il bug');
  });

  it('is the first text block when the content is an array', async () => {
    const content = [{ type: 'image', source: {} }, { type: 'text', text: ' Guarda questo ' }, { type: 'text', text: 'Altro' }];
    expect(await firstMessageOf('s', userEntry(content))).toBe('Guarda questo');
  });

  it('skips lines that are not valid JSON', async () => {
    expect(await firstMessageOf('s', '{not json', userEntry('Valido'))).toBe('Valido');
  });

  it('skips entries whose type is not user', async () => {
    expect(await firstMessageOf('s', { type: 'assistant', message: { role: 'assistant', content: 'Risposta' } }, userEntry('Domanda'))).toBe('Domanda');
  });

  it('skips meta and sidechain entries', async () => {
    const entries = [userEntry('Meta', undefined, { isMeta: true }), userEntry('Laterale', undefined, { isSidechain: true }), userEntry('Vero')];
    expect(await firstMessageOf('s', ...entries)).toBe('Vero');
  });

  it('skips entries with only tool_result blocks', async () => {
    expect(await firstMessageOf('s', userEntry([{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]), userEntry('Dopo'))).toBe('Dopo');
  });

  it('turns a slash command with arguments into "name args"', async () => {
    const text = '<command-message>review</command-message>\n<command-name>/review</command-name>\n<command-args>fix the bug</command-args>';
    expect(await firstMessageOf('s', userEntry(text))).toBe('/review fix the bug');
  });

  it('skips a slash command without arguments or with blank arguments', async () => {
    const entries = [
      userEntry('<command-name>/clear</command-name>\n<command-message>clear</command-message>'),
      userEntry('<command-name>/model</command-name>\n<command-args>  </command-args>'),
      userEntry('Dopo i comandi'),
    ];
    expect(await firstMessageOf('s', ...entries)).toBe('Dopo i comandi');
  });

  it('skips local command output and caveats', async () => {
    const entries = [
      userEntry('<local-command-caveat>Caveat: generated by commands</local-command-caveat>'),
      userEntry('<local-command-stdout>Set model</local-command-stdout>'),
      userEntry('Messaggio'),
    ];
    expect(await firstMessageOf('s', ...entries)).toBe('Messaggio');
  });

  it('skips blank text', async () => {
    expect(await firstMessageOf('s', userEntry('   \n '), userEntry([{ type: 'text', text: ' ' }]), userEntry('Pieno'))).toBe('Pieno');
  });

  it('is null when the session has no user message', async () => {
    expect(await firstMessageOf('s', { type: 'assistant', message: { content: 'Solo risposta' } })).toBeNull();
  });
});

describe('SessionHistory read-only', () => {
  // plan-claude_sessions_client/REQ-28
  it('changes nothing under claudeDir: same files, content and modification times', async () => {
    await writeHistorySession(claudeDir, 'p', 's1', [userEntry('Uno', '/work/p')], at('2026-11-01T10:00:00Z'));
    await writeHistorySession(claudeDir, 'q', 's2', ['{broken', userEntry('Due', '/work/q')], at('2026-11-02T10:00:00Z'));
    await mkdir(path.join(claudeDir, 'sessions'));
    await writeFile(path.join(claudeDir, 'sessions', '1.json'), '{"sessionId":"s1"}');
    const before = await snapshotTree(claudeDir);

    await history.list();
    await history.get('s1');
    await history.get('missing');

    expect(await snapshotTree(claudeDir)).toEqual(before);
  });
});

describe('defaultClaudeDir', () => {
  const saved = { config: process.env.CLAUDE_CONFIG_DIR, home: process.env.HOME };

  afterEach(() => {
    if (saved.config === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = saved.config;
    process.env.HOME = saved.home;
  });

  it('is CLAUDE_CONFIG_DIR when it is set', () => {
    process.env.CLAUDE_CONFIG_DIR = '/fixtures/claude';
    expect(defaultClaudeDir()).toBe('/fixtures/claude');
  });

  it.each([undefined, ''])('is <HOME>/.claude when CLAUDE_CONFIG_DIR is %j', (value) => {
    if (value === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = value;
    process.env.HOME = '/fixtures/home';
    expect(defaultClaudeDir()).toBe('/fixtures/home/.claude');
  });

  it('is the folder SessionHistory reads without options', async () => {
    await writeHistorySession(claudeDir, 'p', 'from-env', [userEntry('Ciao', '/work/p')]);
    process.env.CLAUDE_CONFIG_DIR = claudeDir;
    expect((await new SessionHistory().list()).map((s) => s.id)).toEqual(['from-env']);
  });
});
