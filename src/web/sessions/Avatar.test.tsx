import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TerminalIcon } from '../icons/Icons';
import { Avatar, avatarVariantOf, folderNameOf, initialsOf } from './Avatar';
import type { SessionState } from './live-session-store';

const classesOf = (html: string) => html.match(/^<\w+\b[^>]*\sclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
const textOf = (html: string) => html.replace(/<[^>]*>/g, '').trim();

describe('folderNameOf', () => {
  // Avatar spec: the last non-empty segment of the path
  it.each([
    ['/home/u/web-dashboard', 'web-dashboard'],
    ['/home/u/web-dashboard/', 'web-dashboard'],
    ['/home/u//billing-api//', 'billing-api'],
  ])('%s gives %s', (folder, name) => {
    expect(folderNameOf(folder)).toBe(name);
  });

  // Avatar spec: a path with no segment gives the path itself
  it('gives the path itself when it has no segment', () => {
    expect(folderNameOf('/')).toBe('/');
  });
});

describe('initialsOf', () => {
  // Avatar spec and batch decision "Initials": the examples of the spec
  it.each([
    ['/home/u/web-dashboard', 'WD'],
    ['/home/u/infra_terraform', 'IT'],
    ['/home/u/docs site', 'DS'],
    ['/home/u/billing', 'BI'],
    ['/home/u/x', 'X'],
  ])('%s gives %s', (folder, initials) => {
    expect(initialsOf(folder)).toBe(initials);
  });

  // Avatar spec: only the first two words count, empty words are dropped
  it('uses the first two non-empty words', () => {
    expect(initialsOf('/p/--alpha__beta  gamma')).toBe('AB');
    expect(initialsOf('/p/mobile-app-ios')).toBe('MA');
  });

  // Avatar spec: always upper case, whole characters outside ASCII too
  it('is upper case and keeps whole non-ASCII characters', () => {
    expect(initialsOf('/p/élan-über')).toBe('ÉÜ');
    expect(initialsOf('/p/𝒶𝒷c')).toBe('𝒶𝒷'.toUpperCase());
  });

  // Avatar spec: no word gives empty text
  it('gives empty text when the folder name has no word', () => {
    expect(initialsOf('/p/-_-')).toBe('');
  });
});

describe('avatarVariantOf', () => {
  // Avatar spec: the first matching rule wins, external before needs_input and ended
  it('gives external whenever the session is external', () => {
    for (const state of ['working', 'needs_input', 'idle', 'ended'] as SessionState[]) {
      expect(avatarVariantOf({ folder: '/p/a', state, external: true }), state).toBe('external');
    }
  });

  // Avatar spec: amber for needs input, grey for ended
  it('gives attn for needs_input and ended for ended', () => {
    expect(avatarVariantOf({ folder: '/p/a', state: 'needs_input' })).toBe('attn');
    expect(avatarVariantOf({ folder: '/p/a', state: 'ended' })).toBe('ended');
  });

  // Avatar invariant: the same folder always gets the same primary or teal variant, whatever the other state
  it('gives a stable primary or teal variant per folder', () => {
    for (let i = 0; i < 20; i++) {
      const folder = `/home/u/project-${i}`;
      const variants = new Set([undefined, 'working', 'idle'].map((state) => avatarVariantOf({ folder, state: state as SessionState | undefined })));
      expect(variants.size, folder).toBe(1);
      expect(['primary', 'teal']).toContain([...variants][0]);
    }
  });

  // Avatar invariant: both stable variants occur
  it('uses both primary and teal across folders', () => {
    const variants = new Set(Array.from({ length: 40 }, (_, i) => avatarVariantOf({ folder: `/home/u/project-${i}` })));
    expect(variants).toEqual(new Set(['primary', 'teal']));
  });
});

describe('Avatar', () => {
  // Avatar spec: decorative element with the classes avatar, avatar-<size>, avatar-<variant>; list is the default size
  it.each([
    [undefined, 'avatar-list'],
    ['list', 'avatar-list'],
    ['header', 'avatar-header'],
    ['dialog', 'avatar-dialog'],
  ] as const)('size %s has the class %s', (size, sizeClass) => {
    const html = renderToStaticMarkup(<Avatar folder="/p/web-dashboard" state="needs_input" size={size} />);
    expect(html).toMatch(/^<\w+\b[^>]*\saria-hidden="true"/);
    expect(classesOf(html)).toEqual(expect.arrayContaining(['avatar', sizeClass, 'avatar-attn']));
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19: the avatar shows the project initials
  it('shows the initials of the folder', () => {
    const html = renderToStaticMarkup(<Avatar folder="/home/u/web-dashboard" state="working" />);
    expect(textOf(html)).toBe('WD');
    expect(classesOf(html)).toContain(`avatar-${avatarVariantOf({ folder: '/home/u/web-dashboard', state: 'working' })}`);
  });

  // plan-claude_sessions_client-ui_redesign-material3_mock/REQ-24: an external avatar shows the terminal icon and no initials
  it('shows the terminal icon and no initials for an external session', () => {
    const html = renderToStaticMarkup(<Avatar folder="/home/u/mobile-app" state="working" external />);
    expect(classesOf(html)).toContain('avatar-external');
    expect(html.match(/<svg\b/g)).toHaveLength(1);
    expect(html).toContain(renderToStaticMarkup(<TerminalIcon />).match(/<path\b[^>]*>/)?.[0] ?? '<missing terminal path>');
    expect(textOf(html)).toBe('');
  });

  // Avatar invariant: the avatar adds nothing to the accessible name of its container
  it('carries no accessible text', () => {
    const html = renderToStaticMarkup(<Avatar folder="/home/u/web-dashboard" />);
    expect(html).toMatch(/^<\w+\b[^>]*\saria-hidden="true"/);
    expect(html).not.toMatch(/\s(?:aria-label|title|role)=/);
  });
});
