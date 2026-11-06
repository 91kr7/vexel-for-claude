import type { IBufferLine, IDisposable, ILink, ILinkProvider, Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Only whitespace and quotes end an address; closing punctuation at its end is left out.
const ADDRESS_PATTERN = /(https?|HTTPS?):[/]{2}[^\s"']*[^\s"':,.!?{}|\\^~[\]`()<>*]/;

export type LinkTerminal = Pick<Terminal, 'buffer' | 'registerLinkProvider'>;

function fillsLastColumn(line: IBufferLine | undefined): boolean {
  const chars = line?.getCell(line.length - 1)?.getChars();
  return !!chars && chars.trim() !== '';
}

function asWrapped(line: IBufferLine): IBufferLine {
  return {
    isWrapped: true,
    length: line.length,
    getCell: (x, cell) => line.getCell(x, cell),
    translateToString: (trimRight, start, end) => line.translateToString(trimRight, start, end),
  };
}

// The addon ends a range that stops on the last column at column 0 of the next row.
function endingOnItsLastCell(terminal: LinkTerminal, link: ILink): ILink {
  const { end } = link.range;
  const lastRow = terminal.buffer.active.getLine(end.y - 2);
  if (end.x > 0 || !lastRow) return link;
  link.range = { start: link.range.start, end: { x: lastRow.length, y: end.y - 1 } };
  return link;
}

function withExactRanges(terminal: LinkTerminal, provider: ILinkProvider): ILinkProvider {
  return {
    provideLinks: (y, callback) =>
      provider.provideLinks(y, (links) =>
        callback(
          links
            ?.map((link) => endingOnItsLastCell(terminal, link))
            .filter(({ range }) => range.start.y <= y && y <= range.end.y),
        ),
      ),
  };
}

// Claude Code breaks long lines itself, so a row that an address fills to the last column also continues on the next row.
function joiningFullRows(terminal: LinkTerminal): LinkTerminal {
  const buffer = () => terminal.buffer.active;
  const active = {
    getNullCell: () => buffer().getNullCell(),
    getLine: (y: number) => {
      const line = buffer().getLine(y);
      return line && !line.isWrapped && fillsLastColumn(buffer().getLine(y - 1)) ? asWrapped(line) : line;
    },
  };
  return {
    buffer: { active } as unknown as Terminal['buffer'],
    registerLinkProvider: (provider) => terminal.registerLinkProvider(withExactRanges(terminal, provider)),
  };
}

/** Makes the `http` and `https` addresses of the terminal rows links; `activate` gets the click and the full address. */
export function loadWebAddressLinks(terminal: LinkTerminal, activate: (event: MouseEvent, address: string) => void): IDisposable {
  const addon = new WebLinksAddon(activate, { urlRegex: ADDRESS_PATTERN });
  addon.activate(joiningFullRows(terminal) as Terminal);
  return addon;
}
