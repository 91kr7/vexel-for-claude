import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebAddress, openLink } from './link-opener';

describe('isWebAddress', () => {
  // plan-terminal_addons/REQ-12; link-opener spec: http and https in any case
  it.each(['http://example.com', 'https://example.com/a?b=c#d', 'HTTPS://EXAMPLE.COM/x', 'Http://example.com'])('accepts %s', (address) => {
    expect(isWebAddress(address)).toBe(true);
  });

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'mailto:a@b.c', 'ftp://example.com', 'example.com', 'https//example.com', ''])(
    'refuses %s',
    (address) => {
      expect(isWebAddress(address)).toBe(false);
    },
  );
});

describe('openLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // plan-terminal_addons/REQ-10, REQ-11: a new tab with no opener and no referrer
  it('opens a web address in a new tab with no opener', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    openLink('https://example.com/a');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
  });

  // plan-terminal_addons/REQ-12
  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'mailto:a@b.c', 'not a url'])('does nothing for %s', (address) => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    openLink(address);
    expect(open).not.toHaveBeenCalled();
  });
});
