// @vitest-environment jsdom
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangelogText } from './ChangelogText';

// Unit tests of the changelog renderer, plan-release_changelog/REQ-9, REQ-10, REQ-11.
const roots: Root[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  document.body.innerHTML = '';
});

/** The component's own root element; the elements made from the text sit under it. */
function render(text: string): HTMLElement {
  return renderHost(text).firstElementChild as HTMLElement;
}

function renderHost(text: string): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(<ChangelogText text={text} />));
  return host;
}

const textOf = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
const tags = (root: Element) => [...root.querySelectorAll('*')].map((element) => element.tagName.toLowerCase());
const ALLOWED = new Set(['h4', 'p', 'ul', 'li', 'strong', 'em', 'code', 'a']);

describe('ChangelogText', () => {
  // plan-release_changelog/REQ-9
  it.each(['#', '##', '###', '####', '#####', '######'])('shows a "%s" heading as h4 without the signs', (signs) => {
    const host = render(`${signs} New features`);
    const headings = host.querySelectorAll('h4');
    expect(headings).toHaveLength(1);
    expect(textOf(headings[0]!)).toBe('New features');
    expect(textOf(host)).not.toContain('#');
  });

  it.each(['-', '*', '+'])('shows "%s" items as one bullet list without the signs', (sign) => {
    const host = render(`${sign} first\n${sign} second\n${sign} third`);
    const lists = host.querySelectorAll('ul');
    expect(lists).toHaveLength(1);
    expect([...lists[0]!.querySelectorAll('li')].map(textOf)).toEqual(['first', 'second', 'third']);
    expect(textOf(host)).not.toMatch(/^[-*+]|\s[-*+]\s/);
  });

  it('accepts indented items in the same list', () => {
    const host = render('- first\n  - nested');
    expect(host.querySelectorAll('ul')).toHaveLength(1);
    expect([...host.querySelectorAll('li')].map(textOf)).toEqual(['first', 'nested']);
  });

  it('continues an item with a following indented line', () => {
    const host = render('- first line\n  goes on\n- second');
    const items = [...host.querySelectorAll('li')].map(textOf);
    expect(items).toEqual(['first line goes on', 'second']);
  });

  it('joins the lines of a group into one paragraph, and blank lines separate groups', () => {
    const host = render('one line\nsame paragraph\n\nanother paragraph');
    const paragraphs = [...host.querySelectorAll('p')].map(textOf);
    expect(paragraphs).toEqual(['one line same paragraph', 'another paragraph']);
  });

  it('reads \\r\\n as a line end', () => {
    const host = render('## Title\r\n\r\n- a\r\n- b\r\n\r\ntext');
    expect(textOf(host.querySelector('h4')!)).toBe('Title');
    expect([...host.querySelectorAll('li')].map(textOf)).toEqual(['a', 'b']);
    expect([...host.querySelectorAll('p')].map(textOf)).toEqual(['text']);
  });

  it('keeps the order of headings, lists and paragraphs', () => {
    const host = render('## Added\n\n- one\n- two\n\nSome words.');
    const blocks = [...host.children].map((element) => element.tagName.toLowerCase());
    expect(blocks.filter((tag) => ['h4', 'ul', 'p'].includes(tag))).toEqual(['h4', 'ul', 'p']);
  });

  it.each([
    ['**bold**', 'strong', 'bold'],
    ['__bold__', 'strong', 'bold'],
    ['*italic*', 'em', 'italic'],
    ['_italic_', 'em', 'italic'],
    ['`code`', 'code', 'code'],
  ])('shows %s inline as %s', (markup, tag, content) => {
    const host = render(`before ${markup} after`);
    const element = host.querySelector(tag);
    expect(element).not.toBeNull();
    expect(textOf(element!)).toBe(content);
    expect(textOf(host)).toBe(`before ${content} after`);
  });

  it('formats inline markup inside headings and items too', () => {
    const host = render('## The **big** one\n\n- a `flag` here');
    expect(host.querySelector('h4 strong')?.textContent).toBe('big');
    expect(host.querySelector('li code')?.textContent).toBe('flag');
  });

  it('keeps "_" inside a word as text', () => {
    const host = render('use snake_case_name now');
    expect(host.querySelector('em')).toBeNull();
    expect(textOf(host)).toBe('use snake_case_name now');
  });

  it('shows the content of inline code as plain text', () => {
    const host = render('run `**not bold** <b>x</b>` please');
    const code = host.querySelector('code')!;
    expect(code.textContent).toBe('**not bold** <b>x</b>');
    expect(code.children).toHaveLength(0);
  });

  // plan-release_changelog/REQ-10
  it.each(['https://example.com/page', 'http://example.com/page'])('makes %s a link that opens in a new tab', (address) => {
    const host = render(`see [the docs](${address}) here`);
    const links = host.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(textOf(link)).toBe('the docs');
    expect(link.getAttribute('href')).toBe(address);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')?.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
    expect(textOf(host)).toBe('see the docs here');
  });

  // plan-release_changelog/REQ-10, REQ-11
  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', '/relative/path', 'mailto:a@b.c'])(
    'shows the label of a %s link as plain text, with no link',
    (address) => {
      const host = render(`see [the label](${address}) here`);
      expect(host.querySelector('a')).toBeNull();
      expect(textOf(host)).toContain('the label');
      expect(host.innerHTML).not.toContain('href');
    },
  );

  it('leaves images out: no image and no text', () => {
    const host = render('before ![a picture](https://example.com/image.png) after');
    expect(host.querySelector('img')).toBeNull();
    expect(textOf(host)).not.toContain('a picture');
    expect(host.innerHTML).not.toContain('example.com');
    expect(textOf(host)).toMatch(/^before\s*after$/);
  });

  // plan-release_changelog/REQ-11
  it('shows raw HTML as plain text, as written, and never runs it', () => {
    const ran = vi.fn();
    (window as unknown as { ranCode: () => void }).ranCode = ran;
    const raw = '<script>window.ranCode()</script> <button onclick="window.ranCode()">Press</button> <img src=x onerror="window.ranCode()">';
    const host = render(raw);
    expect(host.querySelector('script, button, img, [onclick], [onerror]')).toBeNull();
    expect(host.textContent).toContain('<script>window.ranCode()</script>');
    expect(host.textContent).toContain('<button onclick="window.ranCode()">Press</button>');
    expect(host.textContent).toContain('<img src=x onerror="window.ranCode()">');
    host.querySelector('p')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ran).not.toHaveBeenCalled();
  });

  it('creates only the listed elements, and takes no attribute from the text but a link address', () => {
    const host = render(
      [
        '# Title <i>x</i>',
        '',
        '- **b** _i_ `c` [ok](https://example.com) [bad](javascript:x) ![img](https://example.com/a.png)',
        '',
        '<div style="color:red" class="evil">text</div> <a href="https://evil.example">link</a>',
      ].join('\n'),
    );
    expect(tags(host).filter((tag) => !ALLOWED.has(tag))).toEqual([]);
    for (const element of host.querySelectorAll('*')) {
      for (const attribute of element.getAttributeNames()) {
        expect(attribute.startsWith('on')).toBe(false);
        expect(attribute).not.toBe('style');
        expect(element.getAttribute(attribute)).not.toMatch(/evil|color:red|a\.png|javascript/);
      }
    }
    expect([...host.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(['https://example.com']);
  });

  it('shows other markup as plain text', () => {
    const host = render('> a quote\n\n1. numbered');
    expect(host.querySelector('blockquote, ol')).toBeNull();
    expect(textOf(host)).toContain('> a quote');
    expect(textOf(host)).toContain('1. numbered');
  });
});
