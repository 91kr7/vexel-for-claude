import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveActivity, RunningTool, SessionState, SessionSummary, WaitingFor } from './live-session-store';
import { SessionList } from './SessionList';

const textOf = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const MINUTE = 60_000;
const lastActivity = new Date(Date.now() - 2 * 3600_000).toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface Options {
  liveActivity?: LiveActivity;
  runningTool?: RunningTool;
  external?: boolean;
}

const session = (id: string, state: SessionState, { liveActivity, runningTool, external = false }: Options = {}): SessionSummary => ({
  id,
  folder: `/home/dev/projects/${id}`,
  label: `label ${id}`,
  state,
  lastActivity,
  ...(external ? { external: true as const } : {}),
  ...(runningTool ? { runningTool } : {}),
  ...(liveActivity ? { liveActivity } : {}),
});

const renderList = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);

function entryOf(html: string, id: string): string {
  const part = html.split(/(?=<li\b)/).find((p) => p.includes(`title="/home/dev/projects/${id}"`));
  expect(part, `entry of ${id}`).toBeDefined();
  return part!;
}

/** The element with class `className` in `html`, up to its closing tag. */
function elementOf(html: string, className: string): { start: number; attributes: string; html: string; text: string } | undefined {
  const open = new RegExp(`<(\\w+)([^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*)>`).exec(html);
  if (!open) return undefined;
  const tag = open[1]!;
  let depth = 1;
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  pattern.lastIndex = open.index + open[0].length;
  let match: RegExpExecArray | null = null;
  while (depth > 0 && (match = pattern.exec(html))) depth += match[1] ? -1 : 1;
  const inner = html.slice(open.index + open[0].length, match?.index ?? html.length);
  return { start: open.index, attributes: open[2] ?? '', html: inner, text: textOf(inner) };
}

const stallOf = (entry: string) => elementOf(entry, 'session-entry-stall');
const titleOf = (attributes: string) => /\stitle="([^"]*)"/.exec(attributes)?.[1]?.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

const silent = (silenceMs: number, waitingFor: WaitingFor = 'response', latestText?: LiveActivity['latestText']): LiveActivity => ({
  atWork: true,
  lastEventAt: ago(silenceMs),
  waitingFor,
  ...(latestText && { latestText }),
});
const TESTER: WaitingFor = { subagentType: 'sdd-tester', name: 'Bash', argument: 'mvn test', others: 0 };

describe('SessionList, stall signal', () => {
  // plan-session_activity/REQ-16, REQ-18, REQ-19, REQ-24: the clock icon and the text of the signal
  it('shows the clock icon and the text of the signal on an entry silent for 8 minutes', () => {
    const html = renderList([session('h', 'working', { liveActivity: silent(8 * MINUTE + 5_000, TESTER) })]);
    const stall = stallOf(entryOf(html, 'h'));
    expect(stall?.text).toBe('No activity for 8 min · sdd-tester: mvn test running');
    expect(stall?.html, 'the clock icon before the text').toMatch(/^<svg\b[^>]*\bclass="[^"]*\bicon\b/);
  });

  // session-list spec: the tooltip holds the whole text
  it('has the whole text as tooltip', () => {
    const html = renderList([session('h', 'working', { liveActivity: silent(6 * MINUTE, 'response') })]);
    expect(titleOf(stallOf(entryOf(html, 'h'))?.attributes ?? '')).toBe("No activity for 6 min · waiting for Claude's response");
  });

  // plan-session_activity/REQ-16: from 5 minutes of silence, not before
  it('shows from 5 minutes after the last activity, and not before', () => {
    const html = renderList([
      session('at-five', 'working', { liveActivity: silent(5 * MINUTE) }),
      session('under-five', 'working', { liveActivity: silent(5 * MINUTE - 1_000) }),
      session('fresh', 'working', { liveActivity: silent(0) }),
    ]);
    expect(stallOf(entryOf(html, 'at-five'))?.text).toBe("No activity for 5 min · waiting for Claude's response");
    expect(stallOf(entryOf(html, 'under-five'))).toBeUndefined();
    expect(stallOf(entryOf(html, 'fresh'))).toBeUndefined();
  });

  // plan-session_activity/REQ-16, REQ-20: hosted and external entries at work, idle ones included
  it('shows on working and idle entries at work, hosted and external', () => {
    const several: WaitingFor = { name: 'Bash', argument: 'npm run build', others: 2 };
    const html = renderList([
      session('h-working', 'working', { liveActivity: silent(7 * MINUTE, several) }),
      session('h-idle', 'idle', { liveActivity: silent(7 * MINUTE, TESTER) }),
      session('e-working', 'working', { external: true, liveActivity: silent(7 * MINUTE, several) }),
      session('e-idle', 'idle', { external: true, liveActivity: silent(7 * MINUTE, TESTER) }),
    ]);
    expect(stallOf(entryOf(html, 'h-working'))?.text).toBe('No activity for 7 min · npm run build running +2');
    expect(stallOf(entryOf(html, 'h-idle'))?.text).toBe('No activity for 7 min · sdd-tester: mvn test running');
    expect(stallOf(entryOf(html, 'e-working'))?.text).toBe('No activity for 7 min · npm run build running +2');
    expect(stallOf(entryOf(html, 'e-idle'))?.text).toBe('No activity for 7 min · sdd-tester: mvn test running');
  });

  // plan-session_activity/REQ-23: an entry that needs input never shows the signal, nor does an ended one
  it('shows no signal on an entry that needs input or has ended, even at work', () => {
    const html = renderList([
      session('asking', 'needs_input', { liveActivity: silent(7 * MINUTE, TESTER) }),
      session('ext-asking', 'needs_input', { external: true, liveActivity: silent(7 * MINUTE, TESTER) }),
      session('ended', 'ended', { liveActivity: silent(7 * MINUTE, TESTER) }),
      session('ext-ended', 'ended', { external: true, liveActivity: silent(7 * MINUTE, TESTER) }),
    ]);
    expect(html).not.toContain('session-entry-stall');
    expect(textOf(html)).not.toContain('No activity');
  });

  // session-list spec: only at work, with a valid lastEventAt
  it('shows no signal when the entry is not at work or has no valid last activity', () => {
    const html = renderList([
      session('not-at-work', 'idle', { liveActivity: { atWork: false, lastEventAt: ago(7 * MINUTE), waitingFor: 'response' } }),
      session('working-not-at-work', 'working', { liveActivity: { atWork: false, lastEventAt: ago(7 * MINUTE), waitingFor: 'response' } }),
      session('no-time', 'working', { liveActivity: { atWork: true, waitingFor: 'response' } }),
      session('bad-time', 'working', { liveActivity: { atWork: true, lastEventAt: 'not a time', waitingFor: 'response' } }),
      session('no-activity', 'working'),
    ]);
    expect(html).not.toContain('session-entry-stall');
    expect(textOf(html)).not.toContain('No activity');
  });

  // session-list spec and requirements "Both lines on one entry": under the tool line and the latest-text line, above the progress bar and line 3
  it('shows together with the latest-text line, under it and above the progress bar and line 3', () => {
    const html = renderList([
      session('h', 'working', {
        runningTool: { name: 'Bash', argument: 'mvn test', others: 0 },
        liveActivity: silent(9 * MINUTE, { name: 'Bash', argument: 'mvn test', others: 0 }, { text: 'Running the tests', at: ago(9 * MINUTE) }),
      }),
    ]);
    const entry = entryOf(html, 'h');
    const tool = entry.indexOf('session-entry-tool');
    const latest = entry.indexOf('session-entry-latest');
    const stall = entry.indexOf('session-entry-stall');
    const bar = entry.indexOf('progress-bar');
    const metrics = entry.indexOf('session-entry-metrics');
    expect(tool).toBeGreaterThan(-1);
    expect(latest).toBeGreaterThan(tool);
    expect(stall).toBeGreaterThan(latest);
    expect(bar).toBeGreaterThan(stall);
    expect(metrics).toBeGreaterThan(bar);
    expect(elementOf(entry, 'session-entry-latest')?.text).toBe('Running the tests · 9 min');
    expect(stallOf(entry)?.text).toBe('No activity for 9 min · mvn test running');
  });

  // plan-session_activity/REQ-25: the signal changes neither the state, nor the group, nor the place of an entry
  it('keeps the groups, the order and the states of the entries', () => {
    const list = (silenceMs: number) =>
      renderList([
        session('a', 'working', { liveActivity: silent(silenceMs, TESTER) }),
        session('b', 'idle', { liveActivity: silent(silenceMs, 'response') }),
        session('c', 'needs_input', { liveActivity: silent(silenceMs, TESTER) }),
        session('d', 'working', { external: true, liveActivity: silent(silenceMs, 'response') }),
        session('e', 'idle', { external: true }),
      ]);
    const layoutOf = (html: string) =>
      html
        .replace(/<span class="[^"]*\bsession-entry-stall\b[\s\S]*?<\/span><\/span>/g, '')
        .split(/(?=<h2\b|<li\b)/)
        .slice(1)
        .map((part) => textOf(part));
    const quiet = list(0);
    const stalled = list(7 * MINUTE);
    expect(quiet).not.toContain('session-entry-stall');
    expect(textOf(stalled).match(/No activity for 7 min/g), 'the signal shows on the three silent entries that do not need input').toHaveLength(3);
    expect(layoutOf(stalled)).toEqual(layoutOf(quiet));
  });
});
