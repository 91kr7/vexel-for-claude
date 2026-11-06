import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RunningTool, SessionState, SessionSummary } from './live-session-store';
import { SessionList } from './SessionList';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const lastActivity = new Date().toISOString();
const session = (id: string, state: SessionState, runningTool?: RunningTool, external = false): SessionSummary => ({
  id,
  folder: `/home/dev/progetti/${id}`,
  label: `label ${id}`,
  state,
  lastActivity,
  ...(external ? { external: true as const } : {}),
  ...(runningTool ? { runningTool } : {}),
});

const renderList = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);

/** The html of the entry of a session: from its folder title to the next entry. */
function entryOf(html: string, id: string): string {
  const parts = html.split(/(?=<li\b)/);
  const part = parts.find((p) => p.includes(`title="/home/dev/progetti/${id}"`));
  expect(part, `entry of ${id}`).toBeDefined();
  return part!;
}

/** The tool line of an entry: the element with class session-entry-tool, up to its closing tag. */
function toolLineOf(entry: string): { attributes: string; html: string; text: string } | undefined {
  const open = /<(\w+)([^>]*\bclass="[^"]*\bsession-entry-tool\b[^"]*"[^>]*)>/.exec(entry);
  if (!open) return undefined;
  const tag = open[1]!;
  let depth = 1;
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  pattern.lastIndex = open.index + open[0].length;
  let match: RegExpExecArray | null = null;
  while (depth > 0 && (match = pattern.exec(entry))) depth += match[1] ? -1 : 1;
  const html = entry.slice(open.index + open[0].length, (match?.index ?? entry.length));
  return { attributes: open[2] ?? '', html, text: textOf(html) };
}

const titleOf = (attributes: string) => /\stitle="([^"]*)"/.exec(attributes)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('SessionList, tool line', () => {
  // plan-session_list_improvements/REQ-14, REQ-15: a working hosted entry shows "<name>: <argument>"
  it('shows the tool name and argument on a working hosted entry', () => {
    const html = renderList([session('h', 'working', { name: 'Bash', argument: 'npm test', others: 0 })]);
    const line = toolLineOf(entryOf(html, 'h'));
    expect(line?.text).toBe('Bash: npm test');
    expect(titleOf(line?.attributes ?? '')).toBe('Bash: npm test');
  });

  // plan-session_list_improvements/REQ-14: a working external entry shows its tool line too
  it('shows the tool line on a working external entry', () => {
    const html = renderList([session('e', 'working', { name: 'Read', argument: '/srv/app/main.ts', others: 0 }, true)]);
    expect(toolLineOf(entryOf(html, 'e'))?.text).toBe('Read: /srv/app/main.ts');
  });

  // plan-session_list_improvements/REQ-16: a tool with no main argument shows its name only
  it('shows only the tool name when there is no argument', () => {
    const html = renderList([session('h', 'working', { name: 'TodoWrite', others: 0 })]);
    expect(toolLineOf(entryOf(html, 'h'))?.text).toBe('TodoWrite');
  });

  // plan-session_list_improvements/REQ-19: the count of the other tools, "+N", in its own element
  it('shows "+N" after the tool when other tools run, and nothing when none does', () => {
    const html = renderList([
      session('many', 'working', { name: 'Bash', argument: 'npm test', others: 2 }),
      session('one', 'working', { name: 'Bash', argument: 'npm test', others: 0 }),
    ]);
    const many = toolLineOf(entryOf(html, 'many'));
    expect(many?.text).toBe('Bash: npm test +2');
    expect(many?.html, '"+2" sits in its own element').toMatch(/<\w+[^>]*>\s*\+2\s*<\/\w+>/);
    expect(titleOf(many?.attributes ?? '') ?? '').toMatch(/^Bash: npm test/);
    expect(toolLineOf(entryOf(html, 'one'))?.text).not.toContain('+');
  });

  // plan-session_list_improvements/REQ-22: a working entry with no running tool shows no tool line
  it('shows no tool line on a working entry with no running tool', () => {
    const html = renderList([session('h', 'working'), session('e', 'working', undefined, true)]);
    expect(html).not.toContain('session-entry-tool');
  });

  // plan-session_list_improvements/REQ-23: needs-input, idle and ended entries never show a tool line
  it('shows no tool line in any state but working, even with a runningTool', () => {
    const tool: RunningTool = { name: 'Bash', argument: 'npm test', others: 1 };
    const html = renderList([
      session('asking', 'needs_input', tool),
      session('idle', 'idle', tool),
      session('ended', 'ended', tool),
      session('ext-asking', 'needs_input', tool, true),
      session('ext-idle', 'idle', tool, true),
    ]);
    expect(html).not.toContain('session-entry-tool');
    expect(textOf(html)).not.toContain('Bash: npm test');
  });

  // plan-session_list_improvements/REQ-17: the page keeps the whole argument, the cut is visual only
  it('renders a long argument whole, for the ellipsis to cut it', () => {
    const argument = `echo ${'x'.repeat(200)}`;
    const html = renderList([session('h', 'working', { name: 'Bash', argument, others: 0 })]);
    expect(toolLineOf(entryOf(html, 'h'))?.text).toBe(`Bash: ${argument}`);
  });
});
