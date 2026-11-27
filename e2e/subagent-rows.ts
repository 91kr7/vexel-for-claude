// Geometry of the subagent rows of the turn panel (plan-subagent_panel, batch subagent-list): place of a row, line and ticks of a group.
import { type Locator, expect } from '@playwright/test';

/** Width of the gutter of one level, and place of a tick under the top of its row (TurnTreeView spec). */
export const GUTTER = 14;
export const TICK_TOP = 19;
/** Sub-pixel tolerance of a measured place. */
const PX = 1.5;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Mark extends Box {
  paint: string;
}

/** The box of an element once the finite effects of the page (panel slide, list cascade) have ended. */
export async function settledBox(target: Locator): Promise<Box> {
  await target.page().evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const box = await target.boundingBox();
  expect(box, 'element is rendered').not.toBeNull();
  return box!;
}

/** Left and right edge of the content of the scrolling area: inside its padding and its scrollbar. */
const contentOf = (area: Locator) =>
  area.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const inner = rect.left + el.clientLeft;
    return { left: inner + parseFloat(style.paddingLeft), right: inner + el.clientWidth - parseFloat(style.paddingRight) };
  });

/** The visible lines and ticks of the scrolling area, each with the colour it paints, and the colour of `--role-border-strong`. */
const marksOf = (area: Locator) =>
  area.evaluate((el) => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--role-border-strong)';
    document.body.append(probe);
    const strong = getComputedStyle(probe).color;
    probe.remove();
    const read = (selector: string): Mark[] =>
      [...el.querySelectorAll(selector)].flatMap((mark) => {
        const rect = mark.getBoundingClientRect();
        const style = getComputedStyle(mark);
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return [];
        const border = [style.borderLeftWidth, style.borderTopWidth].findIndex((width) => parseFloat(width) > 0);
        const paint = style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : border === 0 ? style.borderLeftColor : border === 1 ? style.borderTopColor : 'none';
        return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, paint }];
      });
    return { lines: read('.subagent-line'), ticks: read('.subagent-tick'), strong };
  });

/** REQ-8: a row of level n starts n + 1 gutters from the left of the content and ends at its right edge. */
export async function expectRowPlace(area: Locator, row: Locator, level: number, label = `row of level ${level}`): Promise<void> {
  const box = await settledBox(row);
  const content = await contentOf(area);
  expect(Math.abs(box.x - (content.left + (level + 1) * GUTTER)), `${label}: ${level + 1} gutters from the left`).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - content.right), `${label}: reaches the right edge`).toBeLessThanOrEqual(1);
}

/** The rows follow each other top to bottom, `gap` px apart. */
export async function expectOneBelowTheOther(rows: Locator[], gap = 8): Promise<void> {
  const boxes = await Promise.all(rows.map((row) => settledBox(row)));
  for (let i = 1; i < boxes.length; i += 1) {
    const [above, below] = [boxes[i - 1]!, boxes[i]!];
    expect(Math.abs(below.y - (above.y + above.height) - gap), `row ${i} ${gap} px under row ${i - 1}`).toBeLessThanOrEqual(1);
  }
}

/**
 * REQ-10, REQ-11: the members are joined by one 1 px line in the middle of the gutter at their left, from the tick of the first to the
 * tick of the last, and each member has a tick from the line to its left edge, 19 px under its top.
 */
export async function expectJoined(area: Locator, members: Locator[]): Promise<void> {
  const rows = await Promise.all(members.map((member) => settledBox(member)));
  const { lines, ticks, strong } = await marksOf(area);
  const lineX = rows[0]!.x - GUTTER / 2;
  rows.forEach((row, i) => {
    expect(Math.abs(row.x - rows[0]!.x), `member ${i} at the level of the first`).toBeLessThanOrEqual(1);
    const tick = ticks.find((t) => Math.abs(t.y + t.height / 2 - (row.y + TICK_TOP)) <= PX && Math.abs(t.x + t.width - row.x) <= PX);
    expect(tick, `a tick on member ${i}, 19 px under its top, up to its left edge`).toBeDefined();
    expect(Math.abs(tick!.x - lineX), `the tick of member ${i} starts at the line`).toBeLessThanOrEqual(PX);
    expect(tick!.height, `the tick of member ${i} is 1 px`).toBeLessThanOrEqual(PX);
    expect(tick!.paint, `the tick of member ${i} paints --role-border-strong`).toBe(strong);
  });
  const top = rows[0]!.y + TICK_TOP;
  const bottom = rows.at(-1)!.y + TICK_TOP;
  const lastRow = rows.at(-1)!;
  const segments = lines
    .filter((l) => Math.abs(l.x + l.width / 2 - lineX) <= PX && l.y < lastRow.y + lastRow.height && l.y + l.height > rows[0]!.y)
    .sort((a, b) => a.y - b.y);
  expect(segments.length, 'a line in the gutter of the group').toBeGreaterThan(0);
  for (const segment of segments) {
    expect(segment.width, 'the line is 1 px').toBeLessThanOrEqual(PX);
    expect(segment.paint, 'the line paints --role-border-strong').toBe(strong);
  }
  let reached = top;
  for (const segment of segments) if (segment.y <= reached + 1) reached = Math.max(reached, segment.y + segment.height);
  expect(reached, 'the line runs with no gap from the first tick to the last').toBeGreaterThanOrEqual(bottom - 1);
  expect(segments[0]!.y, 'the line starts at the first tick').toBeGreaterThanOrEqual(top - PX);
  expect(Math.max(...segments.map((s) => s.y + s.height)), 'the line ends at the last tick').toBeLessThanOrEqual(bottom + PX);
}

/** REQ-11, REQ-12: no tick at the height of the row, and no line in its own gutter. */
export async function expectNoMark(area: Locator, member: Locator, label = 'row'): Promise<void> {
  const row = await settledBox(member);
  const { lines, ticks } = await marksOf(area);
  const inRow = (mark: Box) => mark.y < row.y + row.height && mark.y + mark.height > row.y;
  expect(
    ticks.filter((t) => inRow(t)),
    `${label}: no tick at its height`,
  ).toEqual([]);
  expect(
    lines.filter((l) => inRow(l) && l.x >= row.x - GUTTER - 0.5 && l.x + l.width <= row.x + 0.5),
    `${label}: no line in its gutter`,
  ).toEqual([]);
}

/** REQ-13: the area needs no horizontal scrolling, and no part of a row pokes out of it. */
export async function expectNoSideways(area: Locator, rows: Locator[]): Promise<void> {
  const sizes = await area.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(sizes.scrollWidth, 'the content fits the width of the area').toBeLessThanOrEqual(sizes.clientWidth);
  for (const [i, row] of rows.entries()) {
    // The right edge each part paints at: an ancestor that clips its overflow (a text cut with an ellipsis) cuts it.
    const overflow = await row.evaluate((el) => {
      const right = el.getBoundingClientRect().right;
      const paintedRight = (child: Element) => {
        let edge = child.getBoundingClientRect().right;
        for (let at = child.parentElement; at && at !== el; at = at.parentElement) {
          if (getComputedStyle(at).overflowX !== 'visible') edge = Math.min(edge, at.getBoundingClientRect().right);
        }
        return edge;
      };
      return Math.max(0, ...[...el.querySelectorAll('*')].map((child) => paintedRight(child) - right));
    });
    expect(overflow, `nothing of row ${i} past its right edge`).toBeLessThanOrEqual(1);
  }
}
