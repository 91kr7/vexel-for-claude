import xtermHeadless from '@xterm/headless';
import { SerializeAddon } from '@xterm/addon-serialize';

const SCROLLBACK_LINES = 10_000;

export class TerminalMirror {
  readonly #terminal: xtermHeadless.Terminal;
  readonly #serializer = new SerializeAddon();

  constructor(cols: number, rows: number) {
    // The serialize addon reads the buffer through the proposed API.
    this.#terminal = new xtermHeadless.Terminal({
      cols,
      rows,
      scrollback: SCROLLBACK_LINES,
      allowProposedApi: true,
    });
    this.#terminal.loadAddon(this.#serializer);
  }

  write(data: string): void {
    this.#terminal.write(data);
  }

  resize(cols: number, rows: number): void {
    this.#terminal.resize(cols, rows);
  }

  snapshot(): Promise<string> {
    // Parsing is asynchronous: an empty write resolves once all earlier data is parsed.
    return new Promise((resolve) => {
      this.#terminal.write('', () => resolve(this.#serializer.serialize()));
    });
  }
}
