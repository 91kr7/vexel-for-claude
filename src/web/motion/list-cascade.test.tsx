// @vitest-environment jsdom
// Tests of plan-ui_transitions, batch cascading-lists: ListCascade spec.
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cascadeDelaysMs, useListCascade } from './list-cascade';

const ENTER_MS = 100;
const CASCADE_MAX_MS = 600;

describe('cascadeDelaysMs', () => {
  // ListCascade "Contract": a short list keeps the 40 ms step
  it('gives a 40 ms step to a short list, starting at 0', () => {
    expect(cascadeDelaysMs(4, 600, 200)).toEqual([0, 40, 80, 120]);
  });

  it('gives one delay per item position', () => {
    for (const count of [0, 1, 7, 33]) expect(cascadeDelaysMs(count, 600, 200)).toHaveLength(count);
  });

  it('gives 0 to a single item', () => {
    expect(cascadeDelaysMs(1, 600, 200)).toEqual([0]);
  });

  // plan-ui_transitions/REQ-22, REQ-31: the last item ends within the cascade limit, however long the list is
  it('shrinks the step of a long list so the last delay plus the enter duration stays within the limit', () => {
    for (const count of [11, 12, 50, 200, 1000]) {
      const delays = cascadeDelaysMs(count, 600, 200);
      expect(delays[0]).toBe(0);
      expect(delays.at(-1)! + 200, `count ${count}`).toBeLessThanOrEqual(600);
      for (let index = 1; index < delays.length; index++) expect(delays[index]!, `count ${count}`).toBeGreaterThanOrEqual(delays[index - 1]!);
    }
  });

  it('uses the whole room of a long list: the last delay is the limit minus the enter duration', () => {
    expect(cascadeDelaysMs(101, 600, 200).at(-1)).toBe(400);
    expect(cascadeDelaysMs(3, 600, 200)[1]).toBe(40);
  });

  it('rounds each delay to whole ms', () => {
    for (const delay of cascadeDelaysMs(7, 300, 100)) expect(Number.isInteger(delay)).toBe(true);
  });

  // ListCascade "Contract": enter duration at or above the limit gives no delay
  it('gives every delay 0 when the enter duration reaches the limit', () => {
    expect(cascadeDelaysMs(5, 200, 200)).toEqual([0, 0, 0, 0, 0]);
    expect(cascadeDelaysMs(5, 200, 300)).toEqual([0, 0, 0, 0, 0]);
  });
});

let root: Root | undefined;
let container: HTMLElement;
let ending: (() => void) | undefined;

function Probe({ keys }: { keys: string[] | undefined }) {
  const { cascadeOf, endCascade } = useListCascade(keys);
  ending = endCascade;
  return (
    <ul>
      {(keys ?? []).map((key) => {
        const cascade = cascadeOf(key);
        return (
          <li key={key} data-key={key} className={cascade?.className} style={cascade?.style}>
            {key}
          </li>
        );
      })}
    </ul>
  );
}

const render = (keys: string[] | undefined) => flushSync(() => root?.render(<Probe keys={keys} />));
const itemOf = (key: string) => container.querySelector<HTMLElement>(`[data-key="${key}"]`);
const cascading = (key: string) => itemOf(key)?.classList.contains('cascade-item') ?? false;
const delayOf = (key: string) => itemOf(key)?.style.getPropertyValue('--cascade-delay');
const delayMs = (key: string) => Number.parseFloat(delayOf(key) ?? '');
const setTokens = (enter: string | null, cascadeMax: string | null) => {
  const style = document.documentElement.style;
  if (enter === null) style.removeProperty('--motion-duration-enter');
  else style.setProperty('--motion-duration-enter', enter);
  if (cascadeMax === null) style.removeProperty('--motion-cascade-max');
  else style.setProperty('--motion-cascade-max', cascadeMax);
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  setTokens(`${ENTER_MS}ms`, `${CASCADE_MAX_MS}ms`);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  ending = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
});

describe('useListCascade', () => {
  // plan-ui_transitions/REQ-16, REQ-17: the first render with keys plays the cascade, each key with the delay of its position
  it('gives each key of the appearance the class cascade-item and the delay of its position', () => {
    render(['a', 'b', 'c']);
    const expected = cascadeDelaysMs(3, CASCADE_MAX_MS, ENTER_MS);
    ['a', 'b', 'c'].forEach((key, index) => {
      expect(cascading(key), key).toBe(true);
      expect(delayMs(key), key).toBe(expected[index]);
      expect(delayOf(key), key).toMatch(/ms$/);
    });
  });

  // ListCascade "Contract": undefined keys (loading) is not the appearance; the first defined keys are
  it('plays the cascade on the first render with keys defined, after renders with undefined keys', () => {
    render(undefined);
    render(undefined);
    render(['a', 'b']);
    expect(cascading('a')).toBe(true);
    expect(delayMs('b')).toBe(40);
  });

  // ListCascade "Contract": the cascade ends after the last delay plus the enter duration
  it('ends after the last delay plus the enter duration', async () => {
    render(['a', 'b', 'c']);
    const end = 80 + ENTER_MS;
    await pause(end / 3);
    expect(cascading('c'), 'still playing').toBe(true);
    await vi.waitFor(() => expect(['a', 'b', 'c'].some(cascading)).toBe(false), { timeout: end * 5, interval: 10 });
    expect(delayOf('a')).toBe('');
  });

  // ListCascade "Contract": endCascade ends the cascade at once
  it('ends the cascade at once on endCascade()', () => {
    render(['a', 'b', 'c']);
    flushSync(() => ending?.());
    expect(['a', 'b', 'c'].some(cascading)).toBe(false);
  });

  // plan-ui_transitions/REQ-20, REQ-21: later changes of the keys start nothing; a later key never cascades
  it('gives no cascade to a key added after the appearance', () => {
    render(['a', 'b']);
    render(['a', 'b', 'new']);
    expect(cascading('new')).toBe(false);
  });

  it('plays only once per mount: a refresh, a reorder or a filter after the cascade ends starts nothing', () => {
    render(['a', 'b', 'c']);
    flushSync(() => ending?.());
    render(['a', 'b', 'c']);
    render(['c', 'b', 'a']);
    render(['b']);
    render(['a', 'b', 'c']);
    expect(['a', 'b', 'c'].some(cascading)).toBe(false);
  });

  it('plays only once per mount even when the keys go back to undefined', () => {
    render(['a', 'b']);
    flushSync(() => ending?.());
    render(undefined);
    render(['a', 'b']);
    expect(['a', 'b'].some(cascading)).toBe(false);
  });

  it('plays again on a new mount', () => {
    render(['a', 'b']);
    flushSync(() => ending?.());
    flushSync(() => root?.unmount());
    root = createRoot(container);
    render(['a', 'b']);
    expect(cascading('b')).toBe(true);
  });

  // ListCascade "Rules": an appearance with no key plays nothing, and a later key does not start it
  it('plays nothing when the appearance has no key, nor for keys that come later', () => {
    render([]);
    render(['a', 'b']);
    expect(['a', 'b'].some(cascading)).toBe(false);
  });

  // plan-ui_transitions/REQ-25: reduced motion sets the tokens to 0ms
  it('plays nothing with reduced motion', () => {
    setTokens('0ms', '0ms');
    render(['a', 'b', 'c']);
    expect(['a', 'b', 'c'].some(cascading)).toBe(false);
  });

  // ListCascade "Rules": no style sheet, no cascade
  it('plays nothing when the tokens are not set', () => {
    setTokens(null, null);
    render(['a', 'b', 'c']);
    expect(['a', 'b', 'c'].some(cascading)).toBe(false);
  });

  // plan-ui_transitions/REQ-26: the items are mounted from the first render
  it('mounts every item at once, from the first render', () => {
    render(['a', 'b', 'c']);
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });
});
