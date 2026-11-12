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
    const lineBreak = host.querySelector('.update-notice-text br');
    expect(lineBreak).not.toBeNull();
    expect((lineBreak!.previousSibling?.textContent ?? '').trimEnd()).toMatch(/is available\.$/);
    expect((lineBreak!.nextSibling?.textContent ?? '').trimStart()).toMatch(/^You have/);
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
