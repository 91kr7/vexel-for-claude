// The width check of plan-terminal_overflow, for the browser and the desktop specs.
import { type Page, expect } from '@playwright/test';
import { currentView } from './motion';

/** Width the fit leaves free for the vertical scrollbar, shown or not (SessionView spec, "Fit"). */
export const SCROLLBAR_WIDTH = 14;
/** Rounding of the browser layout, in px. */
const TOLERANCE = 0.5;

/** Types a line into the session over a second connection, which sends no `resize` (AttachSessionRoute spec). */
export async function sendLine(baseURL: string, sessionId: string, line: string): Promise<void> {
  const socket = new WebSocket(`${baseURL.replace(/^http/, 'ws')}/api/sessions/${sessionId}/attach`);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.send(JSON.stringify({ type: 'input', data: `${line}\r` }));
  socket.close();
}

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface RulerReading {
  /** The size the fake CLI printed the ruler for, `null` until its report shows. */
  cli: { cols: number; rows: number } | null;
  /** The text of the row where the ruler starts, `null` when that row is not on screen. */
  rulerRow: string | null;
  /** Right edge of the last character of the ruler row. */
  markerRight: number;
  cellWidth: number;
  rowHeight: number;
  /** The box inside the padding of the terminal panel. */
  content: Edges;
  screen: Edges;
  /** The grid the terminal draws. */
  cols: number;
  rows: number;
  scrollbar: { left: number; width: number; visible: boolean } | null;
}

/** Reads the terminal of the view that stays, and the ruler printed with `tag` (tags of one length, so none starts another). */
export function readRuler(page: Page, tag: string): Promise<RulerReading> {
  return currentView(page)
    .getByRole('region', { name: /^Terminal/ })
    .evaluate(
      (panel, rulerTag) => {
        const edges = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        const style = getComputedStyle(panel);
        const px = (value: string) => parseFloat(value) || 0;
        const box = panel.getBoundingClientRect();
        const content = {
          left: box.left + px(style.borderLeftWidth) + px(style.paddingLeft),
          right: box.right - px(style.borderRightWidth) - px(style.paddingRight),
          top: box.top + px(style.borderTopWidth) + px(style.paddingTop),
          bottom: box.bottom - px(style.borderBottomWidth) - px(style.paddingBottom),
        };
        const screen = panel.querySelector('.xterm-screen')!.getBoundingClientRect();
        const rowElements = [...panel.querySelectorAll('.xterm-rows > div')];
        const texts = rowElements.map((row) => (row.textContent ?? '').replace(/\s+$/, ''));
        const report = texts.find((text) => text.startsWith(`RULER-DONE ${rulerTag} `))?.match(/ (\d+)x(\d+)$/);
        const rulerIndex = texts.findIndex((text) => text.startsWith(`<${rulerTag}`));
        let markerRight = NaN;
        let cellWidth = NaN;
        if (rulerIndex >= 0) {
          const walker = document.createTreeWalker(rowElements[rulerIndex]!, NodeFilter.SHOW_TEXT);
          const nodes: Text[] = [];
          for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
          let last: { node: Text; index: number } | undefined;
          for (const node of nodes) {
            const index = node.data.search(/\S\s*$/);
            if (index >= 0) last = { node, index };
          }
          const whole = document.createRange();
          whole.setStart(nodes[0]!, 0);
          whole.setEnd(last!.node, last!.index + 1);
          cellWidth = whole.getBoundingClientRect().width / texts[rulerIndex]!.length;
          const marker = document.createRange();
          marker.setStart(last!.node, last!.index);
          marker.setEnd(last!.node, last!.index + 1);
          markerRight = marker.getBoundingClientRect().right;
        }
        const bar = panel.querySelector<HTMLElement>('.xterm-scrollable-element > .scrollbar.vertical');
        const barBox = bar?.getBoundingClientRect();
        return {
          cli: report ? { cols: Number(report[1]), rows: Number(report[2]) } : null,
          rulerRow: rulerIndex >= 0 ? texts[rulerIndex]! : null,
          markerRight,
          cellWidth,
          rowHeight: screen.height / rowElements.length,
          content,
          screen: edges(screen),
          cols: Math.round(screen.width / cellWidth),
          rows: rowElements.length,
          scrollbar:
            bar && barBox && barBox.width > 0
              ? { left: barBox.left, width: barBox.width, visible: !bar.classList.contains('invisible') && parseFloat(getComputedStyle(bar).opacity) > 0 }
              : null,
        };
      },
      tag,
    );
}

/** Asserts that the ruler printed for `reading` shows the right width: plan-terminal_overflow/REQ-1, REQ-2, REQ-3. */
export function expectRulerFits(reading: RulerReading, note: string): void {
  const { cli, content } = reading;
  expect(cli, `${note}: the fake CLI reported the ruler size`).not.toBeNull();
  expect(reading.rulerRow, `${note}: the ruler is on screen`).not.toBeNull();
  expect(reading.cols, `${note}: REQ-3, the CLI has the columns the terminal draws`).toBe(cli!.cols);
  expect(reading.rows, `${note}: Fit, the CLI has the rows the terminal draws`).toBe(cli!.rows);
  expect(reading.rulerRow!.length, `${note}: the ruler takes one row, ending with its marker`).toBe(cli!.cols);
  expect(reading.rulerRow!.endsWith('>'), `${note}: the marker ends the ruler row`).toBe(true);
  expect(reading.markerRight, `${note}: REQ-1, the last column ends inside the panel`).toBeLessThanOrEqual(content.right + TOLERANCE);
  expect(reading.markerRight, `${note}: REQ-2, the last column ends left of the scrollbar`).toBeLessThanOrEqual(
    content.right - SCROLLBAR_WIDTH + TOLERANCE,
  );
  if (reading.scrollbar?.visible) {
    expect(reading.markerRight, `${note}: REQ-2, the shown scrollbar covers no text`).toBeLessThanOrEqual(reading.scrollbar.left + TOLERANCE);
  }
  expect(reading.screen.left, `${note}: the grid starts inside the panel`).toBeGreaterThanOrEqual(content.left - TOLERANCE);
  expect(content.right - SCROLLBAR_WIDTH - reading.screen.right, `${note}: Fit, no room is left for one more column`).toBeLessThan(
    reading.cellWidth + TOLERANCE,
  );
  expect(reading.screen.bottom, `${note}: the last row ends inside the panel`).toBeLessThanOrEqual(content.bottom + TOLERANCE);
  expect(content.bottom - reading.screen.bottom, `${note}: Fit, no room is left for one more row`).toBeLessThan(reading.rowHeight + TOLERANCE);
}

let rulers = 0;

/**
 * Prints a new ruler until one shows the right width, so the width may settle after the change; a width that never
 * gets right fails. Returns the reading of the ruler that passed.
 */
export async function expectRightWidth(page: Page, baseURL: string, sessionId: string, note: string): Promise<RulerReading> {
  let passed: RulerReading | undefined;
  await expect(async () => {
    rulers += 1;
    const tag = `w${String(rulers).padStart(4, '0')}`;
    await sendLine(baseURL, sessionId, `RULER ${tag}`);
    await expect.poll(async () => (await readRuler(page, tag)).cli, { message: `${note}: the ruler ${tag} is printed` }).not.toBeNull();
    const reading = await readRuler(page, tag);
    expectRulerFits(reading, `${note} (ruler ${tag})`);
    passed = reading;
  }).toPass({ timeout: 30_000, intervals: [250, 500, 1000, 2000] });
  return passed!;
}
