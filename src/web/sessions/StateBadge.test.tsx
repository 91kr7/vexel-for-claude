import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CircleAlertIcon, CircleMinusIcon, CirclePauseIcon, LoaderCircleIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';
import { StateBadge, StateIcon } from './StateBadge';

const table: [SessionState, string, ComponentType][] = [
  ['working', 'Lavora', LoaderCircleIcon],
  ['needs_input', 'Richiede input', CircleAlertIcon],
  ['idle', 'In attesa', CirclePauseIcon],
  ['ended', 'Terminata', CircleMinusIcon],
];

const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('StateBadge', () => {
  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20, StateBadge: one inline element with the classes state-badge, label-m and state-<state>
  it.each(table)('%s renders one span with the classes "state-badge", "label-m" and its state class', (state) => {
    const html = renderToStaticMarkup(<StateBadge state={state} />);
    const root = html.match(/^<span\b([^>]*)>[\s\S]*<\/span>$/);
    expect(root, html).not.toBeNull();
    const classes = root?.[1]?.match(/\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    expect(classes).toContain('state-badge');
    expect(classes).toContain('label-m');
    expect(classes).toContain(`state-${state}`);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-20: the board icon of the state, then its name
  it.each(table)('%s shows its icon and then the name "%s"', (state, name, Icon) => {
    const html = renderToStaticMarkup(<StateBadge state={state} />);
    const inner = html.replace(/^<span\b[^>]*>/, '').replace(/<\/span>$/, '');
    const icon = renderToStaticMarkup(<Icon />);
    expect(inner.startsWith(icon), 'the icon comes first').toBe(true);
    expect(inner.slice(icon.length).trim()).toBe(name);
    expect(html.match(/<svg\b/g)).toHaveLength(1);
  });

  // StateBadge: the icon is decorative, the accessible text is the state name
  it.each(table)('%s has the state name as its only text', (state, name) => {
    const html = renderToStaticMarkup(<StateBadge state={state} />);
    expect(textOf(html)).toBe(name);
    expect(html).not.toMatch(/\saria-label=/);
  });

  // StateBadge: each state has its own icon, so two states never look alike without colour
  it('uses a different icon for each state', () => {
    const icons = table.map(([state]) => renderToStaticMarkup(<StateIcon state={state} />));
    expect(new Set(icons).size).toBe(table.length);
  });

  // StateBadge: StateIcon is the icon of the table alone
  it.each(table)('StateIcon for %s is the icon of the table alone', (state, _, Icon) => {
    expect(renderToStaticMarkup(<StateIcon state={state} />)).toBe(renderToStaticMarkup(<Icon />));
  });
});
