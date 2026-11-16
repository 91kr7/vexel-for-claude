// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewerVersionNotice } from './NewerVersionNotice';

// Unit tests of the newer version notice, plan-update_check/REQ-5, REQ-6, REQ-7.
const VERSION = { installedVersion: '0.1.0', newerVersion: '0.2.0', releaseUrl: 'https://github.com/owner/name/releases/tag/v0.2.0' };
const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

function render(onClose = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<NewerVersionNotice version={VERSION} onClose={onClose} />));
  return { host, onClose };
}

/** The accessible name from aria-label, aria-labelledby or the text. */
function nameOf(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) return labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  return (element.textContent ?? '').trim();
}

const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('NewerVersionNotice', () => {
  it('is a status box named "Update Available" with the title', () => {
    const { host } = render();
    const box = host.querySelector('[role="status"]');
    expect(box).not.toBeNull();
    expect(nameOf(box!)).toBe('Update Available');
    expect(text(box!)).toContain('Update Available');
  });

  // plan-update_check/REQ-5
  it('shows the newer and the installed version', () => {
    const { host } = render();
    expect(text(host)).toContain('Version 0.2.0 is available. You have 0.1.0.');
  });

  it('puts "You have" on a new line after "is available."', () => {
    const { host } = render();
    const paragraph = host.querySelector('.update-notice-text');
    const nodes = [...(paragraph?.childNodes ?? [])];
    const breakAt = nodes.findIndex((node) => node.nodeName === 'BR');
    expect(breakAt).toBeGreaterThan(-1);
    const textOf = (part: ChildNode[]) => part.map((node) => node.textContent ?? '').join('').trim();
    expect(textOf(nodes.slice(0, breakAt))).toBe('Version 0.2.0 is available.');
    expect(textOf(nodes.slice(breakAt + 1))).toBe('You have 0.1.0.');
  });

  // plan-update_check/REQ-6
  it('offers the "View Release" link to the release page, in a new tab', () => {
    const { host } = render();
    const links = [...host.querySelectorAll('a')].filter((link) => nameOf(link) === 'View Release');
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute('href')).toBe(VERSION.releaseUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')?.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
  });

  // plan-update_check/REQ-7
  it('calls onClose from the "Close Update Notice" button', () => {
    const { host, onClose } = render();
    const buttons = [...host.querySelectorAll('button')].filter((button) => nameOf(button) === 'Close Update Notice');
    expect(buttons).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    buttons[0]!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes no focus when it appears', () => {
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    const { host } = render();
    expect(document.activeElement).toBe(field);
    expect(host.querySelector('[autofocus]')).toBeNull();
  });
});

describe('NewerVersionNotice changelogs', () => {
  const CHANGELOGS = [
    { version: '0.6.0', text: '## Added\n\n- **fast** mode\n- a [guide](https://example.com/guide)' },
    { version: '0.5.0' },
    { version: '0.4.1', text: 'Small fixes.' },
  ];

  function renderWith(version: NewerVersionWithChangelogs) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    flushSync(() => root.render(<NewerVersionNotice version={version} onClose={vi.fn()} />));
    return host;
  }

  type NewerVersionWithChangelogs = typeof VERSION & { changelogs?: Array<{ version: string; text?: string }> };

  /** Elements named by aria-label or aria-labelledby "Version <x.y.z>": the changelog blocks. */
  const blocks = (host: Element) =>
    [...host.querySelectorAll('[aria-label], [aria-labelledby]')].filter((element) => /^Version \d+\.\d+\.\d+$/.test(nameOf(element)));

  // plan-release_changelog/REQ-7, REQ-8
  it('shows one block per changelog, in the given order, each named and headed by its version', () => {
    const host = renderWith({ ...VERSION, changelogs: CHANGELOGS });
    const found = blocks(host);
    expect(found.map(nameOf)).toEqual(['Version 0.6.0', 'Version 0.5.0', 'Version 0.4.1']);
    for (const [index, block] of found.entries()) {
      expect(text(block).startsWith(`Version ${CHANGELOGS[index]!.version}`)).toBe(true);
    }
  });

  // plan-release_changelog/REQ-9: the text goes through the renderer, not as raw markup
  it('shows the changelog text formatted, with no markup signs', () => {
    const host = renderWith({ ...VERSION, changelogs: CHANGELOGS });
    const first = blocks(host)[0]!;
    expect(first.querySelector('h4')?.textContent).toBe('Added');
    expect([...first.querySelectorAll('li')].map(text)).toEqual(['fast mode', 'a guide']);
    expect(first.querySelector('strong')?.textContent).toBe('fast');
    expect(text(first)).not.toMatch(/##|\*\*|\]\(/);
    const link = first.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.com/guide');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  // plan-release_changelog/REQ-13
  it('shows a changelog without text as its heading alone', () => {
    const host = renderWith({ ...VERSION, changelogs: CHANGELOGS });
    const second = blocks(host)[1]!;
    expect(text(second)).toBe('Version 0.5.0');
  });

  // plan-release_changelog/REQ-12: the title, the versions and both actions sit outside the changelog area
  it('keeps the title, the versions, "View Release" and the close button outside the changelog area', () => {
    const host = renderWith({ ...VERSION, changelogs: CHANGELOGS });
    const found = blocks(host);
    let area: Element = found[0]!.parentElement!;
    while (!found.every((block) => area.contains(block))) area = area.parentElement!;
    const box = host.querySelector('[role="status"]')!;
    expect(area).not.toBe(box);
    const link = [...host.querySelectorAll('a')].find((element) => nameOf(element) === 'View Release')!;
    const close = [...host.querySelectorAll('button')].find((element) => nameOf(element) === 'Close Update Notice')!;
    expect(area.contains(link)).toBe(false);
    expect(area.contains(close)).toBe(false);
    expect(text(area)).not.toContain('Update Available');
    expect(text(area)).not.toContain('is available.');
    // the area comes after the versions text and before "View Release"
    const versions = [...host.querySelectorAll('*')].find((element) => text(element) === 'Version 0.2.0 is available. You have 0.1.0.')!;
    expect(versions.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(area.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // plan-release_changelog/REQ-14
  it('is the same box as before with no changelogs or an empty list', () => {
    const plain = renderWith(VERSION).innerHTML;
    const empty = renderWith({ ...VERSION, changelogs: [] }).innerHTML;
    const absent = renderWith({ ...VERSION, changelogs: undefined }).innerHTML;
    expect(empty).toBe(plain);
    expect(absent).toBe(plain);
    expect(blocks(document.body)).toHaveLength(0);
  });
});
