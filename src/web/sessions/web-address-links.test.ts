import xtermHeadless from '@xterm/headless';
import type { IBufferRange, ILink, ILinkProvider } from '@xterm/xterm';
import { describe, expect, it, vi } from 'vitest';
import { type LinkTerminal, loadWebAddressLinks } from './web-address-links';

const { Terminal } = xtermHeadless;

/** A headless terminal of `cols` columns that received `data`, with the provider of loadWebAddressLinks. */
async function setup(cols: number, data: string) {
  const terminal = new Terminal({ cols, rows: 8, allowProposedApi: true });
  await new Promise<void>((resolve) => terminal.write(data, resolve));
  const providers: ILinkProvider[] = [];
  const dispose = vi.fn();
  const activate = vi.fn();
  const stub = {
    buffer: terminal.buffer,
    registerLinkProvider: (provider: ILinkProvider) => {
      providers.push(provider);
      return { dispose };
    },
  } as unknown as LinkTerminal;
  const handle = loadWebAddressLinks(stub, activate);
  const linksAt = (y: number) =>
    new Promise<ILink[]>((resolve) => {
      const provider = providers[0];
      if (!provider) throw new Error('no link provider');
      provider.provideLinks(y, (links) => resolve(links ?? []));
    });
  return { providers, dispose, activate, handle, linksAt };
}

const range = (startX: number, startY: number, endX: number, endY: number): IBufferRange => ({
  start: { x: startX, y: startY },
  end: { x: endX, y: endY },
});

const summary = (links: ILink[]) => links.map(({ text, range }) => ({ text, range }));

describe('loadWebAddressLinks', () => {
  // web-address-links spec: one provider, dispose() removes it
  it('registers one link provider and removes it on dispose', async () => {
    const { providers, dispose, handle } = await setup(40, 'nothing here');
    expect(providers).toHaveLength(1);
    expect(dispose).not.toHaveBeenCalled();
    handle.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  // plan-terminal_addons/REQ-1, REQ-8: spec example `see https://example.com/a.`
  it('gives the address of a row with its cells, without the final full stop', async () => {
    const { linksAt } = await setup(40, 'see https://example.com/a.');
    expect(summary(await linksAt(1))).toEqual([{ text: 'https://example.com/a', range: range(5, 1, 25, 1) }]);
  });

  // plan-terminal_addons/REQ-8: spec example `(https://a.io/b)`
  it('leaves out the brackets around an address', async () => {
    const { linksAt } = await setup(40, '(https://a.io/b)');
    expect(summary(await linksAt(1))).toEqual([{ text: 'https://a.io/b', range: range(2, 1, 15, 1) }]);
  });

  // plan-terminal_addons/REQ-8
  it.each(['.', ',', ':', '!', '?', ')', ']', '}', '>', ').', '),'])('leaves out the closing "%s" at the end', async (closing) => {
    const { linksAt } = await setup(40, `go https://a.io/b${closing} next`);
    expect((await linksAt(1)).map((link) => link.text)).toEqual(['https://a.io/b']);
  });

  // web-address-links spec: the address ends at the first whitespace, `"` or `'`
  it.each([
    ['a space', 'https://a.io/b next'],
    ['a double quote', '"https://a.io/b"'],
    ['a single quote', "'https://a.io/b' x"],
  ])('ends the address at %s', async (_, row) => {
    const { linksAt } = await setup(40, row);
    expect((await linksAt(1)).map((link) => link.text)).toEqual(['https://a.io/b']);
  });

  // web-address-links spec: only whitespace and quotes end an address
  it('keeps "!" inside an address', async () => {
    const { linksAt } = await setup(60, 'open https://example.com/#!/inbox now');
    expect((await linksAt(1)).map((link) => link.text)).toEqual(['https://example.com/#!/inbox']);
  });

  // plan-terminal_addons/REQ-1; spec: `HTTP://` and `HTTPS://` too
  it('accepts http and the upper case schemes', async () => {
    const { linksAt } = await setup(80, 'http://a.io/x HTTPS://EXAMPLE.COM/Y HTTP://b.io');
    expect((await linksAt(1)).map((link) => link.text)).toEqual(['http://a.io/x', 'HTTPS://EXAMPLE.COM/Y', 'HTTP://b.io']);
  });

  // plan-terminal_addons/REQ-1: only http and https
  it('makes no link of other schemes or of addresses with no scheme', async () => {
    const { linksAt } = await setup(80, 'ftp://a.io/x file:///etc/x www.example.com example.com/x');
    expect(await linksAt(1)).toEqual([]);
  });

  // plan-terminal_addons/REQ-7: soft wrap of the terminal
  it('joins an address that the terminal wraps over the next row', async () => {
    const { linksAt } = await setup(20, 'xx https://example.com/abcdefghijkl. end');
    const expected = [{ text: 'https://example.com/abcdefghijkl', range: range(4, 1, 15, 2) }];
    expect(summary(await linksAt(1))).toEqual(expected);
    expect(summary(await linksAt(2))).toEqual(expected);
  });

  // plan-terminal_addons/REQ-7: spec example, a row filled to its last column with no soft wrap mark
  it('joins a row that the address fills to the last column with the next row', async () => {
    const { linksAt } = await setup(20, 'https://example.com/\r\nabcdef, done');
    const expected = [{ text: 'https://example.com/abcdef', range: range(1, 1, 6, 2) }];
    expect(summary(await linksAt(1))).toEqual(expected);
    expect(summary(await linksAt(2))).toEqual(expected);
  });

  // plan-terminal_addons/REQ-7: two or more rows
  it('joins an address over three filled rows', async () => {
    const { linksAt } = await setup(20, 'https://example.com/\r\nabcdefghijklmnopqrst\r\nuvw, end');
    const expected = [{ text: 'https://example.com/abcdefghijklmnopqrstuvw', range: range(1, 1, 3, 3) }];
    expect(summary(await linksAt(1))).toEqual(expected);
    expect(summary(await linksAt(3))).toEqual(expected);
  });

  // web-address-links spec: only a row whose last column holds a visible character is joined
  it('does not join the next row when the address ends before the last column', async () => {
    const { linksAt } = await setup(20, 'see https://a.io/x\r\nabcdef');
    expect(summary(await linksAt(1))).toEqual([{ text: 'https://a.io/x', range: range(5, 1, 18, 1) }]);
    expect(await linksAt(2)).toEqual([]);
  });

  // web-address-links spec: the join stops after a row that contains a space
  it('stops the join after a row that contains a space', async () => {
    const { linksAt } = await setup(20, 'https://example.com/\r\nabc defghijklmnopqrs\r\ntuv');
    expect(summary(await linksAt(1))).toEqual([{ text: 'https://example.com/abc', range: range(1, 1, 3, 2) }]);
    expect(await linksAt(3)).toEqual([]);
  });

  // web-address-links spec: a continuation row that starts with a space is not joined
  it('does not join a next row that starts with a space', async () => {
    const { linksAt } = await setup(20, 'https://example.com/\r\n  abcdef');
    expect((await linksAt(1)).map((link) => link.text)).toEqual(['https://example.com/']);
    expect(await linksAt(2)).toEqual([]);
  });

  // web-address-links spec: `range` is 1-based with the end included, so an address that ends on the last column ends there
  it.each([
    ['ends a row before a hard break', 'https://example.com/\r\n  abcdef', range(1, 1, 20, 1)],
    ['ends a soft-wrapped row', `xx https://example.c${'om/abcdefghijklmnopq'} end`, range(4, 1, 20, 2)],
  ])('ends the range on the last column when the address %s', async (_, data, expected) => {
    const { linksAt } = await setup(20, data);
    expect((await linksAt(1)).map((link) => link.range)).toEqual([expected]);
  });

  // plan-terminal_addons/REQ-1: an address on the row after a filled row of other text
  it('finds an address that starts on the row after a filled row', async () => {
    const { linksAt } = await setup(20, `${'─'.repeat(20)}\r\nhttps://a.io/x done`);
    expect(summary(await linksAt(2))).toEqual([{ text: 'https://a.io/x', range: range(1, 2, 14, 2) }]);
  });

  // plan-terminal_addons/REQ-1
  it('gives one link per address of a row', async () => {
    const { linksAt } = await setup(60, 'https://a.io/x and http://b.io/y.');
    expect(summary(await linksAt(1))).toEqual([
      { text: 'https://a.io/x', range: range(1, 1, 14, 1) },
      { text: 'http://b.io/y', range: range(20, 1, 32, 1) },
    ]);
  });

  // plan-terminal_addons/REQ-7; spec: activate receives the full address and checks no modifier key
  it('activates a wrapped link with the full address', async () => {
    const { linksAt, activate } = await setup(20, 'https://example.com/\r\nabcdef, done');
    const [link] = await linksAt(2);
    const event = { ctrlKey: false } as MouseEvent;
    link!.activate(event, link!.text);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(event, 'https://example.com/abcdef');
  });
});
