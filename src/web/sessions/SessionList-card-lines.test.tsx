// plan-dark_blue_theme/REQ-21: the three lines of a session card.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionState, SessionSummary, SessionUsage } from './live-session-store';
import { ProgressBar } from './ProgressBar';
import { SessionList } from './SessionList';
import { StateBadge, StateDot } from './StateBadge';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const lastActivity = new Date(Date.now() - 5 * 60_000).toISOString();
const session = (id: string, state: SessionState, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  folder: `/home/dev/projects/${id}`,
  label: `label ${id}`,
  state,
  lastActivity,
  ...extra,
});
const usage: SessionUsage = { context: { used: 45_200, window: 200_000 }, cost: { usd: 1.27 } } as SessionUsage;

const renderList = (sessions: SessionSummary[]) => renderToStaticMarkup(<SessionList sessions={sessions} openSessionId={null} onOpen={() => {}} />);

/** The html of the list item of a session. */
function itemOf(html: string, id: string): string {
  const part = html.split(/(?=<li\b)/).find((p) => p.includes(`title="/home/dev/projects/${id}"`));
  expect(part, `entry of ${id}`).toBeDefined();
  return part!;
}

/** Where the tag whose attributes match `pattern` starts, or -1. */
const at = (html: string, pattern: RegExp) => {
  const found = html.search(pattern);
  return found < 0 ? -1 : html.lastIndexOf('<', found);
};
const line1At = (html: string) => at(html, /class="session-entry-line"/);
const line2At = (html: string) => at(html, /class="[^"]*\bsession-entry-detail\b/);
const line3At = (html: string) => at(html, /class="[^"]*\bsession-entry-metrics\b/);

describe('SessionList card lines', () => {
  it('puts the dot, folder name, star and state name on line 1, the label on line 2 and the metrics on line 3', () => {
    const item = itemOf(renderList([session('web', 'idle', { usage })]), 'web');
    const [one, two, three] = [line1At(item), line2At(item), line3At(item)];
    expect(one).toBeGreaterThanOrEqual(0);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);

    const line1 = item.slice(one, two);
    const order = [
      renderToStaticMarkup(<StateDot state="idle" />),
      'title="/home/dev/projects/web"',
      'session-entry-star-slot',
      renderToStaticMarkup(<StateBadge state="idle" variant="inline" />),
    ].map((part) => line1.indexOf(part));
    expect(order.every((index) => index >= 0), `line 1 holds every part: ${order}`).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    expect(textOf(item.slice(two, three))).toBe('label web');

    const line3 = item.slice(three);
    const parts = ['23%', '$1.27', '5m ago'].map((part) => line3.indexOf(part));
    expect(parts.every((index) => index >= 0), `line 3 holds percentage, cost and time: ${parts}`).toBe(true);
    expect([...parts].sort((a, b) => a - b)).toEqual(parts);
    expect(item.slice(0, three)).not.toContain('23%');
  });

  it('keeps line 3 with only the time when the session has no usage', () => {
    const item = itemOf(renderList([session('bare', 'idle')]), 'bare');
    expect(line3At(item)).toBeGreaterThan(line2At(item));
    expect(textOf(item.slice(line3At(item)))).toMatch(/^5m ago\b/);
  });

  it('puts the tool line and the progress bar of a working entry between line 2 and line 3', () => {
    const item = itemOf(renderList([session('busy', 'working', { usage, runningTool: { name: 'Bash', argument: 'npm test', others: 0 } } as Partial<SessionSummary>)]), 'busy');
    const tool = at(item, /class="[^"]*\bsession-entry-tool\b/);
    const bar = item.indexOf(renderToStaticMarkup(<ProgressBar />));
    expect(tool).toBeGreaterThan(line2At(item));
    expect(bar).toBeGreaterThan(tool);
    expect(line3At(item)).toBeGreaterThan(bar);
  });

  it('shows no metrics line on a needs-input card with no usage', () => {
    const item = itemOf(renderList([session('ask', 'needs_input', { waitingTool: 'Bash' } as Partial<SessionSummary>)]), 'ask');
    expect(item).toMatch(/class="[^"]*\bsession-card\b/);
    expect(line3At(item)).toBe(-1);
  });
});
