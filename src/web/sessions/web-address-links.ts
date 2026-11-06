import type { IBufferLine, IDisposable, Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';

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
    registerLinkProvider: (provider) => terminal.registerLinkProvider(provider),
  };
}

/** Makes the `http` and `https` addresses of the terminal rows links; `activate` gets the click and the full address. */
export function loadWebAddressLinks(terminal: LinkTerminal, activate: (event: MouseEvent, address: string) => void): IDisposable {
  const addon = new WebLinksAddon(activate);
  addon.activate(joiningFullRows(terminal) as Terminal);
  return addon;
}
