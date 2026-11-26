import { beforeEach, describe, expect, it } from 'vitest';
import { type HookEvent, SessionStateTracker } from './session-state-tracker.js';

class FakeSession {
  readonly #exitListeners: (() => void)[] = [];

  constructor(
    readonly id: string,
    readonly cwd: string,
  ) {}

  onExit(listener: () => void): () => void {
    this.#exitListeners.push(listener);
    return () => {};
  }

  exit(): void {
    for (const listener of this.#exitListeners) listener();
  }
}

let tracker: SessionStateTracker;
let session: FakeSession;

const hook = (name: string, fields: Omit<HookEvent, 'hook_event_name'> = {}) => tracker.applyHookEvent('s1', { hook_event_name: name, ...fields });
const permission = (tool: string, tool_input?: unknown) => hook('PermissionRequest', { tool_name: tool, tool_input });
const preToolUse = (tool: string, tool_input?: unknown) => hook('PreToolUse', { tool_name: tool, tool_input });
const permissionPrompt = () => hook('Notification', { notification_type: 'permission_prompt' });
const detail = () => tracker.waitingDetail('s1');
const argument = (text: string) => ({ kind: 'argument', text });
const QUESTIONS = [{ question: 'Which library?', options: [{ label: 'React' }, { label: 'Vue' }] }];

beforeEach(() => {
  tracker = new SessionStateTracker({ now: () => new Date('2026-11-26T10:00:00.000Z') });
  session = new FakeSession('s1', '/home/dev/projects/shop-api');
  tracker.track(session);
  hook('UserPromptSubmit', { prompt: 'Deploy' });
});

describe('SessionStateTracker.waitingDetail', () => {
  // plan-remote_notifications/REQ-31
  it('gives the main argument of a PermissionRequest', () => {
    permission('Bash', { command: 'npm run deploy' });
    expect(tracker.get('s1')?.state).toBe('needs_input');
    expect(detail()).toEqual(argument('npm run deploy'));
  });

  it('a PermissionRequest with no detail leaves none, also over an older detail', () => {
    permission('Bash', { command: 'npm run deploy' });
    permission('Edit');
    expect(detail()).toBeUndefined();
  });

  it('a new PermissionRequest replaces the detail', () => {
    permission('Bash', { command: 'npm run deploy' });
    permission('Edit', { file_path: '/home/dev/projects/shop-api/a.ts' });
    expect(detail()).toEqual(argument('/home/dev/projects/shop-api/a.ts'));
  });

  // plan-remote_notifications/REQ-31
  it('a permission_prompt notification takes the detail of the last PreToolUse when none is set', () => {
    preToolUse('Bash', { command: 'rm -rf build' });
    expect(detail(), 'PreToolUse of a tool keeps the session working: no detail yet').toBeUndefined();
    permissionPrompt();
    expect(tracker.get('s1')?.state).toBe('needs_input');
    expect(detail()).toEqual(argument('rm -rf build'));
  });

  it('a permission_prompt notification keeps the detail already set', () => {
    preToolUse('Bash', { command: 'from the PreToolUse' });
    permission('Bash', { command: 'from the PermissionRequest' });
    permissionPrompt();
    expect(detail()).toEqual(argument('from the PermissionRequest'));
  });

  it('the last PreToolUse counts even when it has no detail', () => {
    preToolUse('Bash', { command: 'npm test' });
    preToolUse('TodoWrite', { todos: [] });
    permissionPrompt();
    expect(detail()).toBeUndefined();
  });

  it('a permission_prompt notification with no PreToolUse before gives none', () => {
    permissionPrompt();
    expect(tracker.get('s1')?.state).toBe('needs_input');
    expect(detail()).toBeUndefined();
  });

  // plan-remote_notifications/REQ-32
  it('a PreToolUse of AskUserQuestion gives its questions', () => {
    preToolUse('AskUserQuestion', { questions: QUESTIONS });
    expect(tracker.get('s1')?.state).toBe('needs_input');
    expect(detail()).toEqual({ kind: 'questions', questions: [{ question: 'Which library?', options: ['React', 'Vue'] }] });
  });

  it('another event that keeps needs_input leaves the detail unchanged', () => {
    permission('Bash', { command: 'npm run deploy' });
    hook('Notification', { notification_type: 'elicitation_dialog' });
    hook('SubagentStop');
    expect(tracker.get('s1')?.state).toBe('needs_input');
    expect(detail()).toEqual(argument('npm run deploy'));
  });

  it.each([
    ['a PostToolUse', () => hook('PostToolUse', { tool_name: 'Bash' })],
    ['a Stop', () => hook('Stop')],
    ['an idle_prompt notification', () => hook('Notification', { notification_type: 'idle_prompt' })],
    ['Esc typed in the session', () => tracker.applyUserInput('s1', '\x1b')],
    ['Ctrl+C typed in the session', () => tracker.applyUserInput('s1', '\x03')],
    ['the exit of the process', () => session.exit()],
  ])('removes the detail when the state leaves needs_input by %s', (_case, leave) => {
    permission('Bash', { command: 'npm run deploy' });
    leave();
    expect(tracker.get('s1')?.state).not.toBe('needs_input');
    expect(detail()).toBeUndefined();
  });

  it('a removed detail does not come back with a later needs_input that brings none', () => {
    permission('Bash', { command: 'npm run deploy' });
    hook('PostToolUse', { tool_name: 'Bash' });
    permission('Edit');
    expect(detail()).toBeUndefined();
  });

  it('gives a copy: changing the result changes nothing in the tracker', () => {
    preToolUse('AskUserQuestion', { questions: QUESTIONS });
    const copy = detail();
    if (copy?.kind !== 'questions') throw new Error('expected questions');
    copy.questions[0]!.options.push('Svelte');
    copy.questions[0]!.question = 'Changed';
    copy.questions.push({ question: 'More?', options: [] });
    expect(detail()).toEqual({ kind: 'questions', questions: [{ question: 'Which library?', options: ['React', 'Vue'] }] });

    permission('Bash', { command: 'npm run deploy' });
    const argumentCopy = detail();
    if (argumentCopy?.kind !== 'argument') throw new Error('expected an argument');
    argumentCopy.text = 'changed';
    expect(detail()).toEqual(argument('npm run deploy'));
  });

  it('gives nothing for an unknown session', () => {
    expect(tracker.waitingDetail('unknown')).toBeUndefined();
  });

  it('never puts the detail in the summary', () => {
    const notified: unknown[] = [];
    tracker.onChange((summary) => notified.push(summary));
    permission('Bash', { command: 'npm run deploy' });
    expect(tracker.get('s1')).not.toHaveProperty('waitingDetail');
    expect(tracker.list()[0]).not.toHaveProperty('waitingDetail');
    expect(notified.at(-1)).toEqual(expect.not.objectContaining({ waitingDetail: expect.anything() }));
    expect(tracker.get('s1')?.waitingTool).toBe('Bash');
  });
});
