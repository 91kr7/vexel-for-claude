import { describe, expect, it } from 'vitest';
import type { AttentionEvent, WaitingDetail } from './attention-client.js';
import { REMOTE_BODY_MAX_BYTES, REMOTE_PRIORITY_HIGH, SHORTENED_LINE, remoteNotificationMessage } from './remote-notification-text.js';

const MINUTE = 60_000;
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

function waiting(fields: { waitingTool?: string; waitingDetail?: WaitingDetail } = {}): AttentionEvent {
  return { id: 'ev-1', sessionId: 's1', kind: 'needs_input', folder: '/home/dev/projects/ai-client', label: 'Fix the login form', ...fields };
}

describe('remoteNotificationMessage: title and priority', () => {
  // plan-remote_notifications/REQ-30
  it('titles the notification with the folder name and the label of the session', () => {
    expect(remoteNotificationMessage(waiting(), MINUTE).title).toBe('ai-client · Fix the login form');
  });

  // plan-remote_notifications/REQ-30
  it('takes the last non-empty segment of a folder that ends with a slash', () => {
    const event = { ...waiting(), folder: '/home/dev/billing/', label: 'billing' };
    expect(remoteNotificationMessage(event, MINUTE).title).toBe('billing · billing');
  });

  // plan-remote_notifications/REQ-35
  it('uses the high priority of ntfy, 4', () => {
    expect(REMOTE_PRIORITY_HIGH).toBe(4);
    expect(remoteNotificationMessage(waiting(), MINUTE).priority).toBe(4);
    expect(remoteNotificationMessage(waiting({ waitingTool: 'Bash' }), MINUTE).priority).toBe(4);
  });
});

describe('remoteNotificationMessage: body', () => {
  // plan-remote_notifications/REQ-31, REQ-34
  it('names the tool and shows its argument for a permission request', () => {
    const event = waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text: 'npm run build && npm test' } });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe('Permission for Bash\nnpm run build && npm test\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-31
  it('shows the file path of an Edit', () => {
    const event = waiting({ waitingTool: 'Edit', waitingDetail: { kind: 'argument', text: '/home/dev/projects/ai-client/src/login.ts' } });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe('Permission for Edit\n/home/dev/projects/ai-client/src/login.ts\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-31
  it('names only the tool when no detail is known', () => {
    expect(remoteNotificationMessage(waiting({ waitingTool: 'Write' }), MINUTE).message).toBe('Permission for Write\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-32
  it('shows each question, then one "- " line per option', () => {
    const event = waiting({
      waitingDetail: {
        kind: 'questions',
        questions: [
          { question: 'Which library?', options: ['React', 'Vue'] },
          { question: 'Write the tests too?', options: [] },
          { question: 'Which port?', options: ['3000'] },
        ],
      },
    });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe(
      'Claude asks:\nWhich library?\n- React\n- Vue\nWrite the tests too?\nWhich port?\n- 3000\nWaiting for 1 min',
    );
  });

  // plan-remote_notifications/REQ-32
  it('shows the questions also when a waiting tool is known', () => {
    const event = waiting({ waitingTool: 'AskUserQuestion', waitingDetail: { kind: 'questions', questions: [{ question: 'Go on?', options: ['Yes'] }] } });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe('Claude asks:\nGo on?\n- Yes\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-33
  it('says "Needs your input" when nothing is known', () => {
    expect(remoteNotificationMessage(waiting(), MINUTE).message).toBe('Needs your input\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-33; RemoteNotificationText: an argument with no waiting tool
  it('says "Needs your input" with no detail for an argument with no waiting tool', () => {
    const event = waiting({ waitingDetail: { kind: 'argument', text: 'npm test' } });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe('Needs your input\nWaiting for 1 min');
  });

  it('treats an empty waiting tool as no tool', () => {
    expect(remoteNotificationMessage(waiting({ waitingTool: '' }), MINUTE).message).toBe('Needs your input\nWaiting for 1 min');
  });

  // plan-remote_notifications/REQ-34
  it.each([
    [0, 0],
    [59_999, 0],
    [60_000, 1],
    [64_000, 1],
    [119_999, 1],
    [120_000, 2],
    [61 * MINUTE + 30_000, 61],
  ])('after %i ms of waiting says "Waiting for %i min"', (waitedMs, minutes) => {
    expect(remoteNotificationMessage(waiting(), waitedMs).message.split('\n').at(-1)).toBe(`Waiting for ${minutes} min`);
  });

  it('keeps a multi-line argument as it is', () => {
    const event = waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text: 'cd app\nnpm test' } });
    expect(remoteNotificationMessage(event, MINUTE).message).toBe('Permission for Bash\ncd app\nnpm test\nWaiting for 1 min');
  });
});

/** The full message the contract describes, before any shortening. */
function fullMessage(firstLine: string, detail: string, waitingLine: string): string {
  return `${firstLine}\n${detail}\n${waitingLine}`;
}

/** The longest start of `detail`, cut at a whole character, that fits in `budget` bytes. */
function longestStart(detail: string, budget: number): string {
  let kept = '';
  for (const character of detail) {
    if (bytes(kept + character) > budget) break;
    kept += character;
  }
  return kept;
}

function expectShortened(message: string, firstLine: string, detail: string, waitingLine: string): void {
  const tail = `\n${SHORTENED_LINE}\n${waitingLine}`;
  const budget = REMOTE_BODY_MAX_BYTES - bytes(`${firstLine}\n`) - bytes(tail);
  expect(bytes(message)).toBeLessThanOrEqual(REMOTE_BODY_MAX_BYTES);
  expect(message).toBe(`${firstLine}\n${longestStart(detail, budget)}${tail}`);
  expect(message).not.toContain('�');
}

describe('remoteNotificationMessage: shortening', () => {
  it('keeps the ntfy limit of 4,096 bytes and the "[Text shortened]" line', () => {
    expect(REMOTE_BODY_MAX_BYTES).toBe(4096);
    expect(SHORTENED_LINE).toBe('[Text shortened]');
  });

  // plan-remote_notifications/REQ-36
  it('cuts a long command, says it was shortened, and keeps the waiting line', () => {
    const command = `npm run deploy -- ${'--flag '.repeat(1000)}`;
    const message = remoteNotificationMessage(waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text: command } }), MINUTE).message;
    expectShortened(message, 'Permission for Bash', command, 'Waiting for 1 min');
    expect(message.startsWith('Permission for Bash\nnpm run deploy -- --flag')).toBe(true);
  });

  // plan-remote_notifications/REQ-36: a multi-byte text is cut at a whole character
  it.each([
    ['two-byte characters', 'è'.repeat(3000)],
    ['three-byte characters', '€'.repeat(2000)],
    ['four-byte characters after one ASCII byte', `a${'😀'.repeat(1500)}`],
    ['four-byte characters after two ASCII bytes', `ab${'😀'.repeat(1500)}`],
    ['four-byte characters after three ASCII bytes', `abc${'😀'.repeat(1500)}`],
  ])('cuts a text of %s at a whole character, within 4,096 bytes', (_case, text) => {
    const message = remoteNotificationMessage(waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text } }), 2 * MINUTE).message;
    expectShortened(message, 'Permission for Bash', text, 'Waiting for 2 min');
  });

  // plan-remote_notifications/REQ-32, REQ-36
  it('cuts the question lines as one detail', () => {
    const questions = Array.from({ length: 40 }, (_, index) => ({ question: `Question ${index}: ${'ä'.repeat(40)}?`, options: ['Yes', 'No'] }));
    const detail = questions.flatMap((item) => [item.question, ...item.options.map((option) => `- ${option}`)]).join('\n');
    const message = remoteNotificationMessage(waiting({ waitingDetail: { kind: 'questions', questions } }), MINUTE).message;
    expectShortened(message, 'Claude asks:', detail, 'Waiting for 1 min');
  });

  // RemoteNotificationText: a message of at most 4,096 bytes is never cut
  it('does not cut a message of exactly 4,096 bytes', () => {
    const overhead = bytes(fullMessage('Permission for Bash', '', 'Waiting for 1 min'));
    const text = 'é'.repeat((REMOTE_BODY_MAX_BYTES - overhead - 2) / 2) + 'xy';
    const message = remoteNotificationMessage(waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text } }), MINUTE).message;
    expect(bytes(message)).toBe(4096);
    expect(message).toBe(fullMessage('Permission for Bash', text, 'Waiting for 1 min'));
    expect(message).not.toContain(SHORTENED_LINE);
  });

  // plan-remote_notifications/REQ-36
  it('cuts a message of 4,097 bytes', () => {
    const overhead = bytes(fullMessage('Permission for Bash', '', 'Waiting for 1 min'));
    const text = 'x'.repeat(REMOTE_BODY_MAX_BYTES - overhead + 1);
    const message = remoteNotificationMessage(waiting({ waitingTool: 'Bash', waitingDetail: { kind: 'argument', text } }), MINUTE).message;
    expectShortened(message, 'Permission for Bash', text, 'Waiting for 1 min');
  });
});
