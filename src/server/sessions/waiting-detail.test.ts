import { describe, expect, it } from 'vitest';
import { waitingDetailOf } from './waiting-detail.js';

const permission = (tool_name: string, tool_input?: unknown) => ({ hook_event_name: 'PermissionRequest', tool_name, tool_input });
const preToolUse = (tool_name: string, tool_input?: unknown) => ({ hook_event_name: 'PreToolUse', tool_name, tool_input });
const ask = (questions: unknown, hook_event_name = 'PreToolUse') => ({ hook_event_name, tool_name: 'AskUserQuestion', tool_input: { questions } });

describe('waitingDetailOf: hook events read', () => {
  it.each(['Notification', 'PostToolUse', 'UserPromptSubmit', 'Stop'])('gives nothing for a %s event, also with a tool input', (name) => {
    expect(waitingDetailOf({ hook_event_name: name, tool_name: 'Bash', tool_input: { command: 'npm test' } })).toBeUndefined();
  });
});

describe('waitingDetailOf: permission requests', () => {
  // plan-remote_notifications/REQ-31
  it('gives the Bash command as the argument', () => {
    expect(waitingDetailOf(permission('Bash', { command: 'npm run build && npm test', description: 'Build and test' }))).toEqual({
      kind: 'argument',
      text: 'npm run build && npm test',
    });
  });

  // plan-remote_notifications/REQ-31
  it.each(['Edit', 'Write'])('gives the file path of %s as the argument', (tool) => {
    expect(waitingDetailOf(permission(tool, { file_path: '/home/dev/app/src/login.ts', old_string: 'a', new_string: 'b' }))).toEqual({
      kind: 'argument',
      text: '/home/dev/app/src/login.ts',
    });
  });

  it('gives the argument of a PreToolUse event too', () => {
    expect(waitingDetailOf(preToolUse('Bash', { command: 'ls' }))).toEqual({ kind: 'argument', text: 'ls' });
  });

  it('falls back to the first string value of the input, as the main argument rule says', () => {
    expect(waitingDetailOf(permission('mcp__db__query', { limit: 5, sql: 'select 1' }))).toEqual({ kind: 'argument', text: 'select 1' });
  });

  it('keeps the text whole: no trim and no cut', () => {
    const command = `  echo "${'x'.repeat(6000)}"\n  && npm test  `;
    expect(waitingDetailOf(permission('Bash', { command }))).toEqual({ kind: 'argument', text: command });
  });

  it.each([
    ['no tool input', undefined],
    ['a null tool input', null],
    ['a string tool input', 'npm test'],
    ['an input with no string value', { timeout: 10 }],
    ['a blank main argument', { command: '   ' }],
    ['an empty main argument', { command: '' }],
  ])('gives nothing for %s', (_case, input) => {
    expect(waitingDetailOf(permission('Bash', input))).toBeUndefined();
  });
});

describe('waitingDetailOf: questions of AskUserQuestion', () => {
  // plan-remote_notifications/REQ-32
  it('gives each question with the labels of its options, in order', () => {
    const questions = [
      { question: 'Which library?', header: 'Library', options: [{ label: 'React', description: 'UI' }, { label: 'Vue' }], multiSelect: false },
      { question: 'Add tests?', options: [{ label: 'Yes' }, { label: 'No' }] },
    ];
    expect(waitingDetailOf(ask(questions))).toEqual({
      kind: 'questions',
      questions: [
        { question: 'Which library?', options: ['React', 'Vue'] },
        { question: 'Add tests?', options: ['Yes', 'No'] },
      ],
    });
  });

  // plan-remote_notifications/REQ-32
  it('reads the questions of a PermissionRequest of AskUserQuestion too', () => {
    expect(waitingDetailOf(ask([{ question: 'Go on?', options: [{ label: 'Yes' }] }], 'PermissionRequest'))).toEqual({
      kind: 'questions',
      questions: [{ question: 'Go on?', options: ['Yes'] }],
    });
  });

  it('keeps the questions and the labels whole: no trim', () => {
    expect(waitingDetailOf(ask([{ question: '  Which one?  ', options: [{ label: ' A ' }] }]))).toEqual({
      kind: 'questions',
      questions: [{ question: '  Which one?  ', options: [' A '] }],
    });
  });

  it('skips the items with no question, a blank question or a question that is not a string', () => {
    const questions = [{ options: [{ label: 'A' }] }, { question: '  ', options: [] }, { question: 7 }, 'Which?', null, { question: 'Kept?', options: [] }];
    expect(waitingDetailOf(ask(questions))).toEqual({ kind: 'questions', questions: [{ question: 'Kept?', options: [] }] });
  });

  it('keeps only the non-blank string labels, and no options when options is not an array', () => {
    const questions = [
      { question: 'First?', options: [{ label: 'A' }, { label: '' }, { label: '  ' }, { label: 3 }, 'B', null, {}, { label: 'C' }] },
      { question: 'Second?', options: 'Yes or no' },
      { question: 'Third?' },
    ];
    expect(waitingDetailOf(ask(questions))).toEqual({
      kind: 'questions',
      questions: [
        { question: 'First?', options: ['A', 'C'] },
        { question: 'Second?', options: [] },
        { question: 'Third?', options: [] },
      ],
    });
  });

  it.each([
    ['an empty question list', []],
    ['no valid question', [{ question: '' }, { options: [] }]],
    ['questions that are not an array', { question: 'Which?' }],
    ['no questions field', undefined],
  ])('gives nothing for %s, never an argument', (_case, questions) => {
    const event = { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions, description: 'Ask the user' } };
    expect(waitingDetailOf(event)).toBeUndefined();
  });

  it('gives nothing when the tool input is not an object', () => {
    expect(waitingDetailOf({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: 'Which?' })).toBeUndefined();
  });
});
