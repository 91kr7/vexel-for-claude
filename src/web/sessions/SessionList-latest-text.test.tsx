import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveActivity, RunningTool, SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';

const textOf = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const lastActivity = new Date().toISOString();
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

const latestLineOf = (entry: string) => elementOf(entry, 'session-entry-latest');
const titleOf = (attributes: string) => /\stitle="([^"]*)"/.exec(attributes)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const atWork = (text: string, extra: { subagentType?: string; at?: string } = {}): LiveActivity => ({ atWork: true, latestText: { text, ...extra } });

describe('SessionList, latest-text line', () => {
  // plan-session_activity/REQ-2, REQ-8: a working hosted entry shows the text, " · " and the time since it
  it('shows the text, then " · " and the time since it, on a working hosted entry', () => {
    const html = renderList([session('h', 'working', { liveActivity: atWork('I am reading the config files', { at: ago(3 * 60_000 + 5_000) }) })]);
    const line = latestLineOf(entryOf(html, 'h'));
    expect(line?.text).toBe('I am reading the config files · 3 min');
    expect(line?.html, 'the time is a <time> element').toMatch(/<time\b[^>]*>3 min<\/time>/);
  });

  // plan-session_activity/REQ-2: external entries too
  it('shows the line on a working external entry', () => {
    const html = renderList([session('e', 'working', { external: true, liveActivity: atWork('The module has three parts', { at: ago(42_000) }) })]);
    expect(latestLineOf(entryOf(html, 'e'))?.text).toBe('The module has three parts · 42 s');
  });

  // plan-session_activity/REQ-1, REQ-11: an idle entry at work (a running subagent) shows the line
  it('shows the line on an idle entry that is at work', () => {
    const html = renderList([
      session('h', 'idle', { liveActivity: atWork('Scanning the repository', { subagentType: 'general-purpose' }) }),
      session('e', 'idle', { external: true, liveActivity: atWork('Scanning too', { subagentType: 'Explore' }) }),
    ]);
    expect(latestLineOf(entryOf(html, 'h'))?.text).toBe('general-purpose: Scanning the repository');
    expect(latestLineOf(entryOf(html, 'e'))?.text).toBe('Explore: Scanning too');
  });

  // plan-session_activity/REQ-4: the subagent type before the text, in its own element
  it('puts "<subagent type>: " before the text in its own element', () => {
    const html = renderList([session('h', 'working', { liveActivity: atWork('Overwriting the whole CommonServiceImpl class', { subagentType: 'sdd-developer', at: ago(0) }) })]);
    const line = latestLineOf(entryOf(html, 'h'));
    expect(line?.text).toBe('sdd-developer: Overwriting the whole CommonServiceImpl class · 0 s');
    expect(line?.html, 'the type sits in its own element').toMatch(/<(\w+)[^>]*>sdd-developer: <\/\1>/);
  });

  // session-list spec: the tooltip holds the prefix and the text, not the time
  it('has the prefix and the text as tooltip', () => {
    const html = renderList([session('h', 'working', { liveActivity: atWork('Running "npm test" & co', { subagentType: 'sdd-tester', at: ago(5_000) }) })]);
    expect(titleOf(latestLineOf(entryOf(html, 'h'))?.attributes ?? '')).toBe('sdd-tester: Running "npm test" & co');
    const plain = renderList([session('p', 'working', { liveActivity: atWork('Plain text', { at: ago(5_000) }) })]);
    expect(titleOf(latestLineOf(entryOf(plain, 'p'))?.attributes ?? '')).toBe('Plain text');
  });

  // plan-session_activity/REQ-13: no type → no prefix; no time → no " · " and no time
  it('leaves out only the parts whose data is missing', () => {
    const html = renderList([
      session('no-type', 'working', { liveActivity: atWork('Text with time', { at: ago(10_000) }) }),
      session('no-time', 'working', { liveActivity: atWork('Text with type', { subagentType: 'Explore' }) }),
      session('neither', 'working', { liveActivity: atWork('Bare text') }),
    ]);
    expect(latestLineOf(entryOf(html, 'no-type'))?.text).toBe('Text with time · 10 s');
    const noTime = latestLineOf(entryOf(html, 'no-time'));
    expect(noTime?.text).toBe('Explore: Text with type');
    expect(noTime?.html).not.toContain('<time');
    expect(latestLineOf(entryOf(html, 'neither'))?.text).toBe('Bare text');
    const entry = entryOf(html, 'neither');
    expect(textOf(entry), 'the rest of the entry shows as usual').toContain('label neither');
    expect(entry).toContain('session-entry-metrics');
  });

  // plan-session_activity/REQ-7: the page gets the whole text; the cut to two lines is visual
  it('renders a long text whole, with the time after it', () => {
    const long = `${'Refactoring the payment module and updating every caller of it. '.repeat(5)}`.trim();
    const html = renderList([session('h', 'working', { liveActivity: atWork(long, { at: ago(1_000) }) })]);
    const line = latestLineOf(entryOf(html, 'h'));
    expect(line?.text).toBe(`${long} · 1 s`);
    const text = elementOf(line?.html ?? '', 'session-entry-latest-text');
    const time = elementOf(line?.html ?? '', 'session-entry-latest-time');
    expect(text?.text, 'the text in its own element').toBe(long);
    expect(time?.text, 'the time in its own element, after the text').toBe(' · 1 s');
    expect(time!.start).toBeGreaterThan(text!.start);
  });

  // session-list spec: under the tool line, above the progress bar and line 3
  it('sits under the tool line and above the progress bar and line 3', () => {
    const html = renderList([
      session('h', 'working', { runningTool: { name: 'Bash', argument: 'npm test', others: 0 }, liveActivity: atWork('Running the tests', { at: ago(1_000) }) }),
    ]);
    const entry = entryOf(html, 'h');
    const label = entry.indexOf('label h');
    const tool = entry.indexOf('session-entry-tool');
    const latest = entry.indexOf('session-entry-latest');
    const bar = entry.indexOf('progress-bar');
    const metrics = entry.indexOf('session-entry-metrics');
    expect(label).toBeGreaterThan(-1);
    expect(tool).toBeGreaterThan(label);
    expect(latest).toBeGreaterThan(tool);
    expect(bar).toBeGreaterThan(latest);
    expect(metrics).toBeGreaterThan(bar);
  });

  // plan-session_activity/REQ-11: no line on an entry that needs input or has ended, even when liveActivity says at work
  it('shows no line on an entry that needs input or has ended', () => {
    const activity = atWork('Text of the last turn', { subagentType: 'Explore', at: ago(5_000) });
    const html = renderList([
      session('asking', 'needs_input', { liveActivity: activity }),
      session('ended', 'ended', { liveActivity: activity }),
      session('ext-asking', 'needs_input', { external: true, liveActivity: activity }),
      session('ext-ended', 'ended', { external: true, liveActivity: activity }),
    ]);
    expect(html).not.toContain('session-entry-latest');
    expect(textOf(html)).not.toContain('Text of the last turn');
  });

  // plan-session_activity/REQ-11: no line on an entry that is not at work, or with no latest text, or with no liveActivity
  it('shows no line when the entry is not at work or has no latest text', () => {
    const html = renderList([
      session('not-at-work', 'idle', { liveActivity: { atWork: false, latestText: { text: 'Stale text' } } }),
      session('working-not-at-work', 'working', { liveActivity: { atWork: false, latestText: { text: 'Stale text' } } }),
      session('no-text', 'working', { liveActivity: { atWork: true } }),
      session('no-activity', 'working'),
    ]);
    expect(html).not.toContain('session-entry-latest');
    expect(textOf(html)).not.toContain('Stale text');
  });
});
