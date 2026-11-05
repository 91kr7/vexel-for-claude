import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  FAKE_CLI,
  RecordingViewer,
  delay,
  hex,
  renderLines,
  tempDir,
  waitFor,
  writeFakeCliWrapper,
} from '../test-support.js';
import { type Session, SessionRegistry } from './session-registry.js';

const started: Session[] = [];
let workDir: string;

function startFake(registry = new SessionRegistry({ command: FAKE_CLI }), cwd = workDir): Session {
  const session = registry.start(cwd);
  started.push(session);
  return session;
}

/** Attaches a viewer and waits until the fake CLI has printed its start banner. */
async function attachReady(session: Session): Promise<RecordingViewer> {
  const viewer = new RecordingViewer();
  session.attach(viewer);
  await waitFor(() => viewer.text.includes('READY'), 'fake CLI banner');
  return viewer;
}

function receivedInput(text: string): string[] {
  return [...text.matchAll(/IN:([0-9a-f]+)/g)].map((match) => match[1] ?? '');
}

beforeAll(async () => {
  workDir = await tempDir();
});

afterAll(async () => {
  for (const session of started) session.write('/exit\r');
  await delay(200);
});

describe('SessionRegistry command', () => {
  const savedEnv = { cli: process.env.AI_CLIENT_CLAUDE_CLI, path: process.env.PATH };
  let binDir: string;
  let customCli: string;

  beforeAll(async () => {
    binDir = await tempDir('ai-client-bin-');
    await writeFakeCliWrapper(binDir, 'claude', 'default-claude');
    customCli = await writeFakeCliWrapper(binDir, 'custom-cli', 'custom');
    process.env.PATH = `${binDir}:${savedEnv.path ?? ''}`;
  });

  afterEach(() => {
    if (savedEnv.cli === undefined) delete process.env.AI_CLIENT_CLAUDE_CLI;
    else process.env.AI_CLIENT_CLAUDE_CLI = savedEnv.cli;
  });

  afterAll(() => {
    process.env.PATH = savedEnv.path;
  });

  it('uses AI_CLIENT_CLAUDE_CLI when it is set', async () => {
    process.env.AI_CLIENT_CLAUDE_CLI = customCli;
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:custom');
  });

  it('uses `claude` when AI_CLIENT_CLAUDE_CLI is not set', async () => {
    delete process.env.AI_CLIENT_CLAUDE_CLI;
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:default-claude');
  });

  it('uses `claude` when AI_CLIENT_CLAUDE_CLI is empty', async () => {
    process.env.AI_CLIENT_CLAUDE_CLI = '';
    const viewer = await attachReady(startFake(new SessionRegistry()));
    expect(viewer.text).toContain('MARK:default-claude');
  });

  it('options.command wins over the environment variable', async () => {
    delete process.env.AI_CLIENT_CLAUDE_CLI;
    const viewer = await attachReady(startFake(new SessionRegistry({ command: customCli })));
    expect(viewer.text).toContain('MARK:custom');
  });
});

describe('SessionRegistry.start', () => {
  it('spawns the CLI in the given folder, with no arguments, at 120x30', async () => {
    const viewer = await attachReady(startFake());
    expect(viewer.text).toContain(`CWD:${workDir}`);
    expect(viewer.text).toContain('ARGS:[]');
    expect(viewer.text).toContain('SIZE:120x30');
  });

  it('passes the server environment plus TERM and COLORTERM', async () => {
    const saved = { term: process.env.TERM, color: process.env.COLORTERM, mark: process.env.FAKE_CLI_MARK };
    process.env.TERM = 'dumb';
    process.env.COLORTERM = '';
    process.env.FAKE_CLI_MARK = 'server-env';
    try {
      const viewer = await attachReady(startFake());
      expect(viewer.text).toContain('TERM:xterm-256color');
      expect(viewer.text).toContain('COLORTERM:truecolor');
      expect(viewer.text).toContain('MARK:server-env');
    } finally {
      process.env.TERM = saved.term;
      process.env.COLORTERM = saved.color;
      if (saved.mark === undefined) delete process.env.FAKE_CLI_MARK;
      else process.env.FAKE_CLI_MARK = saved.mark;
    }
  });

  it('gives each session a new UUID and keeps it by id', () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const a = startFake(registry);
    const b = startFake(registry);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(a.id).toMatch(uuid);
    expect(b.id).toMatch(uuid);
    expect(a.id).not.toBe(b.id);
    expect(registry.get(a.id)).toBe(a);
    expect(registry.get(b.id)).toBe(b);
    expect(a.cwd).toBe(workDir);
  });

  it('get returns undefined for an unknown id', () => {
    expect(new SessionRegistry({ command: FAKE_CLI }).get('no-such-id')).toBeUndefined();
  });
});

describe('Session input and size', () => {
  it('the registry writes nothing to the pty on its own', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(100, 40);
    await waitFor(() => viewer.text.includes('WINCH:100x40'), 'resize');
    await delay(500);
    expect(receivedInput(viewer.text)).toEqual([]);
  });

  it('write sends the data unchanged, control characters and Esc included', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    const data = 'héllo\x1b\x03\t/help\r';
    session.write(data);
    await waitFor(() => viewer.text.includes('LINE:'), 'input echo');
    expect(receivedInput(viewer.text).join('')).toBe(hex(data));
  });

  it('resize resizes the pty', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(90, 20);
    await waitFor(() => viewer.text.includes('WINCH:90x20'), 'pty resize');
  });

  it('resize also resizes the mirror', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.resize(50, 20);
    session.write(`${'y'.repeat(70)}\r`);
    await waitFor(() => viewer.text.includes(`LINE:${'y'.repeat(20)}`), 'echo');
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.frames.length > 0, 'snapshot');
    const lines = await renderLines(late.frames[0] ?? '', 50, 20);
    // LINE: plus 70 characters wraps at 50 columns.
    expect(lines).toContain(`LINE:${'y'.repeat(45)}`);
  });

  it('exited becomes true when the process ends; write and resize then have no effect', async () => {
    const registry = new SessionRegistry({ command: FAKE_CLI });
    const session = startFake(registry);
    const viewer = await attachReady(session);
    expect(session.exited).toBe(false);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'process exit');
    expect(() => session.write('more\r')).not.toThrow();
    expect(() => session.resize(80, 24)).not.toThrow();
    expect(registry.get(session.id)).toBe(session);
    expect(viewer.text).toContain('BYE');
  });
});

describe('Session.attach', () => {
  it('first send is the snapshot with the output produced before attach', async () => {
    const session = startFake();
    await attachReady(session);
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.frames.length > 0, 'snapshot');
    expect(late.frames[0]).toContain('FAKE-CLI');
    expect(late.frames[0]).toContain('READY');
  });

  it('then forwards live output', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    const before = viewer.frames.length;
    session.write('live\r');
    await waitFor(() => viewer.frames.slice(before).join('').includes('LINE:live'), 'live output');
  });

  it('pty output reaches the mirror when no viewer is attached', async () => {
    const session = startFake();
    await delay(800);
    session.write('unseen\r');
    await delay(500);
    const viewer = new RecordingViewer();
    session.attach(viewer);
    await waitFor(() => viewer.frames.length > 0, 'snapshot');
    expect(viewer.frames[0]).toContain('READY');
    expect(viewer.frames[0]).toContain('LINE:unseen');
  });

  it('snapshot plus live output lose and repeat nothing while output flows', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('COUNT\r');
    await delay(400);
    const late = new RecordingViewer();
    session.attach(late);
    await waitFor(() => late.text.includes('COUNT-DONE'), 'count end', 15_000);
    const numberedLines = (await renderLines(late.text)).filter((line) => /^L\d{5}$/.test(line));
    const expected = Array.from({ length: 400 }, (_, i) => `L${String(i + 1).padStart(5, '0')}`);
    expect(numberedLines).toEqual(expected);
  });

  it('several viewers each get the full sequence', async () => {
    const session = startFake();
    const first = await attachReady(session);
    const second = await attachReady(session);
    session.write('both\r');
    await waitFor(() => first.text.includes('LINE:both') && second.text.includes('LINE:both'), 'both viewers');
  });

  it('detach stops delivery and the process keeps running', async () => {
    const session = startFake();
    const leaving = await attachReady(session);
    const staying = await attachReady(session);
    const detach = session.attach(leaving);
    detach();
    const count = leaving.frames.length;
    session.write('after\r');
    await waitFor(() => staying.text.includes('LINE:after'), 'output after detach');
    await delay(200);
    expect(leaving.frames.length).toBe(count);
    expect(session.exited).toBe(false);
  });

  it('detaching every viewer never stops the process', async () => {
    const session = startFake();
    const viewer = new RecordingViewer();
    const detach = session.attach(viewer);
    await waitFor(() => viewer.text.includes('READY'), 'banner');
    detach();
    await delay(500);
    expect(session.exited).toBe(false);
    const again = new RecordingViewer();
    session.attach(again);
    session.write('still-here\r');
    await waitFor(() => again.text.includes('LINE:still-here'), 'process still answers');
  });

  it('calls end() once when the process ends', async () => {
    const session = startFake();
    const viewer = await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => viewer.ended > 0, 'end');
    await delay(300);
    expect(viewer.ended).toBe(1);
  });

  it('attaching to an ended session sends the snapshot, then end()', async () => {
    const session = startFake();
    await attachReady(session);
    session.write('/exit\r');
    await waitFor(() => session.exited, 'exit');
    const late = new RecordingViewer();
    const calls: string[] = [];
    session.attach({
      send: (data) => {
        calls.push('send');
        late.send(data);
      },
      end: () => {
        calls.push('end');
        late.end();
      },
    });
    await waitFor(() => late.ended > 0, 'end');
    await delay(200);
    expect(calls).toEqual(['send', 'end']);
    expect(late.frames[0]).toContain('BYE');
  });
});
