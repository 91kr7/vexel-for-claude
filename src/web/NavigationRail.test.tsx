import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NavigationRail } from './NavigationRail';

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const noop = () => {};

const renderRail = (needsInputCount: number, shownView?: 'sessions' | 'projects') =>
  renderToStaticMarkup(
    <NavigationRail needsInputCount={needsInputCount} onNewSession={noop} onShowSessions={noop} onShowProjects={noop} onResume={noop} shownView={shownView} />,
  );

interface Button {
  attributes: string;
  html: string;
}

const buttons = (html: string): Button[] =>
  [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attributes: m[1] ?? '', html: m[2] ?? '' }));

/** Accessible name of a button: aria-label, else its text without aria-hidden subtrees. */
function nameOf(button: Button): string {
  const label = button.attributes.match(/aria-label="([^"]*)"/)?.[1];
  if (label !== undefined) return label;
  let html = button.html;
  for (let previous = ''; previous !== html; ) {
    previous = html;
    html = html.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/, '');
  }
  return textOf(html);
}

const byName = (html: string, name: string) => buttons(html).filter((b) => nameOf(b) === name);
const badgeOf = (button: Button) => button.html.match(/<(\w+)([^>]*class="[^"]*\bnav-rail-badge\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/);

describe('NavigationRail', () => {
  // NavigationRail "Description": a nav labelled "Main Navigation"
  it('is a nav labelled "Main Navigation"', () => {
    expect(renderRail(0)).toMatch(/^<nav\b[^>]*aria-label="Main Navigation"/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-14, REQ-17, plan-recent_projects/REQ-1: no logo, then the four buttons in order
  it('shows no logo and the buttons "New Claude Code Session", "Sessions", "Projects" and "Resume", in this order', () => {
    const html = renderRail(0);
    expect(html).not.toMatch(/role="img"/);
    expect(html).not.toContain('Vexel');
    expect(buttons(html).map(nameOf)).toEqual(['New Claude Code Session', 'Sessions', 'Projects', 'Resume']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-17: a divider between "New Claude Code Session" and "Sessions"
  it('places an element between "New Claude Code Session" and "Sessions"', () => {
    const html = renderRail(0);
    const between = html.slice(html.indexOf('</button>') + '</button>'.length, html.indexOf('<button', html.indexOf('</button>')));
    expect(between).toMatch(/^<\w+\b[^>]*>/);
  });

  // NavigationRail rules: the icons are decorative
  it('hides every icon of the buttons from assistive technology', () => {
    for (const button of buttons(renderRail(3))) {
      const svgs = [...button.html.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
      expect(svgs.length, nameOf(button)).toBeGreaterThan(0);
      for (const svg of svgs) expect(svg, nameOf(button)).toContain('aria-hidden="true"');
    }
  });

  // NavigationRail "Shows": only the button of shownView has aria-current="page"; default sessions
  it.each([
    [0, undefined, 'Sessions'],
    [4, 'sessions', 'Sessions'],
    [0, 'projects', 'Projects'],
    [4, 'projects', 'Projects'],
  ] as const)('with %i sessions needing input and shownView %s, marks only "%s" as the current page', (count, shownView, current) => {
    const html = renderRail(count, shownView);
    for (const name of ['New Claude Code Session', 'Sessions', 'Projects', 'Resume']) {
      const attributes = byName(html, name)[0]?.attributes;
      if (name === current) expect(attributes, name).toMatch(/aria-current="page"/);
      else expect(attributes, name).not.toMatch(/aria-current/);
    }
  });

  // plan-recent_projects/REQ-1, REQ-2: a click on "Projects" calls onShowProjects
  it('calls onShowProjects on a click of "Projects", and only it', () => {
    const calls: string[] = [];
    const element = NavigationRail({
      needsInputCount: 0,
      onNewSession: () => calls.push('new'),
      onShowSessions: () => calls.push('sessions'),
      onShowProjects: () => calls.push('projects'),
      onResume: () => calls.push('resume'),
    });
    const find = (node: unknown): { props: { onClick?: () => void } } | undefined => {
      if (!node || typeof node !== 'object') return undefined;
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = find(child);
          if (found) return found;
        }
        return undefined;
      }
      const props = (node as { props?: Record<string, unknown> }).props;
      if (props?.['aria-label'] === 'Projects') return node as { props: { onClick?: () => void } };
      return find(props?.children);
    };
    find(element)?.props.onClick?.();
    expect(calls).toEqual(['projects']);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9: the badge shows the number on "Sessions"
  it.each([1, 3, 12])('shows the badge %i on "Sessions", hidden from assistive technology', (count) => {
    const sessions = byName(renderRail(count), 'Sessions');
    expect(sessions, 'the accessible name stays "Sessions"').toHaveLength(1);
    const badge = badgeOf(sessions[0]!);
    expect(badge).not.toBeNull();
    expect(textOf(badge?.[3] ?? '')).toBe(String(count));
    expect(badge?.[2]).toContain('aria-hidden="true"');
  });

  // NavigationRail "Shows": the badge on "Sessions" in both views
  it('keeps the badge on "Sessions" when the projects view is shown', () => {
    const html = renderRail(2, 'projects');
    const badge = badgeOf(byName(html, 'Sessions')[0]!);
    expect(textOf(badge?.[3] ?? '')).toBe('2');
    expect(badgeOf(byName(html, 'Projects')[0]!)).toBeNull();
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-9: hidden at zero
  it('shows no badge and no number when no session needs input', () => {
    const html = renderRail(0);
    expect(html).not.toMatch(/\bnav-rail-badge\b/);
    expect(textOf(html)).not.toMatch(/\d/);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-18: no visible label; the tooltip holds the name, hidden from assistive technology
  it.each(['New Claude Code Session', 'Sessions', 'Projects', 'Resume'])('"%s" has no visible label and its name in a hidden tooltip', (name) => {
    const button = byName(renderRail(0), name)[0];
    expect(button, name).toBeDefined();
    let visible = button?.html ?? '';
    for (let previous = ''; previous !== visible; ) {
      previous = visible;
      visible = visible.replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/, '');
    }
    expect(textOf(visible)).toBe('');
    expect(textOf(button?.html ?? '')).toBe(name);
    expect(button?.html).toMatch(new RegExp(`<\\w+\\b[^>]*aria-hidden="true"[^>]*>${name}</`));
  });
});
