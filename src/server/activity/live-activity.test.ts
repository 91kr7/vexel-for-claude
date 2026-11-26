import { describe, expect, it } from 'vitest';
import type { SessionState } from '../sessions/session-state-tracker.js';
import { liveActivityOf } from './live-activity.js';
import type { SubagentView, TimedText, TurnModel } from './turn-model.js';

type Model = Pick<TurnModel, 'mainText' | 'subagents'>;

/** A turn model with fixed values. Its subagents keep their state whatever `sessionEnded` is, and the calls are recorded. */
function modelOf(main: TimedText | undefined, subagents: SubagentView[] = []): Model & { endedArgs: boolean[] } {
  const endedArgs: boolean[] = [];
  return {
    endedArgs,
    mainText: () => main,
    subagents: (sessionEnded: boolean) => {
      endedArgs.push(sessionEnded);
      return subagents;
    },
  };
}

const text = (value: string, order: number, at?: string): TimedText => ({ text: value, order, ...(at !== undefined && { at }) });
const subagent = (id: string, state: SubagentView['state'], latestText?: TimedText, agentType?: string): SubagentView => ({
  id,
  meta: agentType === undefined ? {} : { agentType },
  state,
  ...(latestText && { latestText }),
});

const T1 = '2026-11-26T10:01:00.000Z';
const T2 = '2026-11-26T10:02:00.000Z';
const T3 = '2026-11-26T10:03:00.000Z';

describe('liveActivityOf, at work', () => {
  // plan-session_activity/REQ-1: a working session is at work
  it('is at work while the session is working', () => {
    expect(liveActivityOf(modelOf(undefined), 'working')).toEqual({ atWork: true });
  });

  // plan-session_activity/REQ-1: an idle or needs-input session with a running subagent is at work
  it.each<SessionState>(['idle', 'needs_input'])('is at work in state %s while a subagent runs', (state) => {
    const model = modelOf(undefined, [subagent('agent-a', 'running')]);
    expect(liveActivityOf(model, state).atWork).toBe(true);
  });

  // plan-session_activity/REQ-1, REQ-11: no running subagent and not working → not at work, with no text
  it.each<SessionState>(['idle', 'needs_input'])('is not at work in state %s with no running subagent, and has no text', (state) => {
    const model = modelOf(text('Main text', 1, T1), [subagent('agent-f', 'finished', text('F', 2, T2)), subagent('agent-s', 'stopped', text('S', 3, T3))]);
    expect(liveActivityOf(model, state)).toEqual({ atWork: false });
  });

  // plan-session_activity/REQ-11: an ended session is never at work
  it('is not at work when the session ended, even with a subagent that the model reports running', () => {
    const model = modelOf(text('Main text', 1, T1), [subagent('agent-a', 'running', text('Sub', 2, T2))]);
    expect(liveActivityOf(model, 'ended')).toEqual({ atWork: false });
  });

  // live-activity spec: the subagents are asked with sessionEnded = (state is "ended")
  it('asks the model for the subagents with sessionEnded true only when the session ended', () => {
    const idle = modelOf(undefined, [subagent('agent-a', 'running')]);
    liveActivityOf(idle, 'idle');
    expect(idle.endedArgs.length).toBeGreaterThan(0);
    expect(idle.endedArgs.every((arg) => arg === false)).toBe(true);
    const ended = modelOf(undefined, [subagent('agent-a', 'running')]);
    liveActivityOf(ended, 'ended');
    expect(ended.endedArgs.every((arg) => arg === true)).toBe(true);
  });
});

describe('liveActivityOf, latest text', () => {
  // plan-session_activity/REQ-2: the latest text of the main conversation, with no type, and its time
  it('gives the main text with its time and no subagent type', () => {
    const result = liveActivityOf(modelOf(text('Reading the files', 1, T1)), 'working');
    expect(result).toEqual({ atWork: true, latestText: { text: 'Reading the files', at: T1 } });
  });

  // plan-session_activity/REQ-3, REQ-4: a running subagent that wrote last wins, with its type
  it('gives the text of a running subagent that wrote after the main conversation, with its type', () => {
    const model = modelOf(text('Main text', 5, T1), [subagent('agent-a', 'running', text('Overwriting the whole CommonServiceImpl class', 2, T2), 'sdd-developer')]);
    expect(liveActivityOf(model, 'working')).toEqual({
      atWork: true,
      latestText: { text: 'Overwriting the whole CommonServiceImpl class', subagentType: 'sdd-developer', at: T2 },
    });
  });

  // plan-session_activity/REQ-3: the main conversation wins when it wrote last
  it('gives the main text when it was written after the subagent text', () => {
    const model = modelOf(text('Main text', 1, T3), [subagent('agent-a', 'running', text('Sub text', 2, T2), 'Explore')]);
    expect(liveActivityOf(model, 'working').latestText).toEqual({ text: 'Main text', at: T3 });
  });

  // live-activity spec: with the same time, or a time unknown on either side, the order decides
  it('compares the order when the times are equal or one is unknown', () => {
    const same = modelOf(text('Main text', 1, T2), [subagent('agent-a', 'running', text('Sub text', 2, T2), 'Explore')]);
    expect(liveActivityOf(same, 'working').latestText?.text).toBe('Sub text');
    const untimedMain = modelOf(text('Main text', 3), [subagent('agent-a', 'running', text('Sub text', 2, T3), 'Explore')]);
    expect(liveActivityOf(untimedMain, 'working').latestText?.text).toBe('Main text');
    const untimedSub = modelOf(text('Main text', 1, T3), [subagent('agent-a', 'running', text('Sub text', 2), 'Explore')]);
    expect(liveActivityOf(untimedSub, 'working').latestText).toEqual({ text: 'Sub text', subagentType: 'Explore' });
  });

  // plan-session_activity/REQ-3: among several running subagents, the one that wrote last
  it('picks the latest text among several running subagents', () => {
    const model = modelOf(undefined, [
      subagent('agent-a', 'running', text('A text', 9, T1), 'Explore'),
      subagent('agent-b', 'running', text('B text', 1, T3), 'sdd-tester'),
      subagent('agent-c', 'running', text('C text', 5, T2), 'Plan'),
    ]);
    expect(liveActivityOf(model, 'idle')).toEqual({ atWork: true, latestText: { text: 'B text', subagentType: 'sdd-tester', at: T3 } });
  });

  // plan-session_activity/REQ-3: the text of a finished or stopped subagent is never the latest text
  it('ignores the texts of finished and stopped subagents', () => {
    const model = modelOf(text('Main text', 1, T1), [
      subagent('agent-f', 'finished', text('Finished text', 2, T2), 'Explore'),
      subagent('agent-s', 'stopped', text('Stopped text', 3, T3), 'Plan'),
    ]);
    expect(liveActivityOf(model, 'working').latestText).toEqual({ text: 'Main text', at: T1 });
  });

  // plan-session_activity/REQ-1, REQ-2: an idle session at work through a subagent shows the subagent text, not the main one
  it('gives the subagent text, not an older main text, when the turn ended and a subagent runs', () => {
    const model = modelOf(text('Turn summary', 1, T1), [subagent('agent-a', 'running', text('Background step', 2, T2), 'general-purpose')]);
    expect(liveActivityOf(model, 'idle').latestText).toEqual({ text: 'Background step', subagentType: 'general-purpose', at: T2 });
  });

  // plan-session_activity/REQ-10: at work with no text yet → no latestText
  it('has no latestText when no conversation has a text', () => {
    expect(liveActivityOf(modelOf(undefined, [subagent('agent-a', 'running')]), 'working')).toEqual({ atWork: true });
  });

  // plan-session_activity/REQ-6: the text is plain, on one line
  it('gives the text as plain text on one line', () => {
    const result = liveActivityOf(modelOf(text('I am **reading** the `config` files\n- [docs](https://example.com) _now_', 1, T1)), 'working');
    expect(result.latestText?.text).toBe('I am reading the config files docs now');
  });

  // plan-session_activity/REQ-6: at most 400 characters, with "…" when cut
  it('cuts a text longer than 400 characters to 399 and "…", and keeps one of 400', () => {
    const long = liveActivityOf(modelOf(text('a'.repeat(500), 1, T1)), 'working').latestText?.text ?? '';
    expect([...long]).toHaveLength(400);
    expect(long).toBe(`${'a'.repeat(399)}…`);
    expect(liveActivityOf(modelOf(text('b'.repeat(400), 1, T1)), 'working').latestText?.text).toBe('b'.repeat(400));
  });

  // live-activity spec: a text that is empty once plain gives no latestText
  it('has no latestText when the plain text is empty', () => {
    expect(liveActivityOf(modelOf(text('```\n```', 1, T1)), 'working')).toEqual({ atWork: true });
  });

  // plan-session_activity/REQ-13: an unknown subagent type or time hides only that part
  it('leaves out an empty or missing subagent type and a missing time', () => {
    const noType = modelOf(undefined, [subagent('agent-a', 'running', text('No type', 1, T1))]);
    expect(liveActivityOf(noType, 'working')).toEqual({ atWork: true, latestText: { text: 'No type', at: T1 } });
    const emptyType = modelOf(undefined, [subagent('agent-a', 'running', text('Empty type', 1), '')]);
    const result = liveActivityOf(emptyType, 'working');
    expect(result).toEqual({ atWork: true, latestText: { text: 'Empty type' } });
    expect(Object.keys(result.latestText ?? {})).toEqual(['text']);
  });
});
