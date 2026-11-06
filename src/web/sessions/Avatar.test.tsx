import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Avatar, folderNameOf, initialsOf } from './Avatar';

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

describe('Avatar', () => {
  // Avatar spec: one decorative element with the class avatar
  it('is one decorative element with the class avatar', () => {
    const html = renderToStaticMarkup(<Avatar folder="/p/web-dashboard" />);
    expect(html).toMatch(/^<\w+\b[^>]*\saria-hidden="true"/);
    expect(classesOf(html)).toContain('avatar');
  });

  // Avatar spec: the avatar shows the folder initials
  it('shows the initials of the folder', () => {
    const html = renderToStaticMarkup(<Avatar folder="/home/u/web-dashboard" />);
    expect(textOf(html)).toBe('WD');
    expect(html).not.toMatch(/<svg\b/);
  });

  // Avatar invariant: no colour or shape per project
  it('has the same classes for every folder', () => {
    const classes = ['/home/u/web-dashboard', '/home/u/billing', '/srv/infra_terraform'].map((folder) =>
      classesOf(renderToStaticMarkup(<Avatar folder={folder} />)).sort().join(' '),
    );
    expect(new Set(classes).size).toBe(1);
  });

  // Avatar invariant: the avatar adds nothing to the accessible name of its container
  it('carries no accessible text', () => {
    const html = renderToStaticMarkup(<Avatar folder="/home/u/web-dashboard" />);
    expect(html).toMatch(/^<\w+\b[^>]*\saria-hidden="true"/);
    expect(html).not.toMatch(/\s(?:aria-label|title|role)=/);
  });
});
