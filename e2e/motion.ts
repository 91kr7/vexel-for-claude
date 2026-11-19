// Helpers for specs that meet the effects of plan-ui_transitions: they act on the view that stays and measure at rest.
import type { Locator, Page } from '@playwright/test';

/** The view of the main area that stays: during a session cross-fade the leaving view is still in the page. */
export const currentView = (page: Page) => page.getByRole('main').locator('.main-view:not(.is-leaving)');

/** Waits for the finite animations of the element, and of its descendants with `subtree`: its place is measured at rest. */
export async function settled(target: Locator, subtree = false): Promise<void> {
  await target.evaluate(
    (el, deep) =>
      Promise.all(
        el
          .getAnimations({ subtree: deep })
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    subtree,
  );
}

/** Waits until no finite animation of the page plays, including those started while it waits. */
export async function pageSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let round = 0; round < 20; round++) {
      const playing = document
        .getAnimations()
        .filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity);
      if (playing.length === 0) return;
      await Promise.all(playing.map((animation) => animation.finished.catch(() => undefined)));
      await new Promise(requestAnimationFrame);
    }
  });
}

/** The session entries that stay: a removed entry fades out in its place before it goes. */
export const STAYING_ENTRY = '.session-entry:not(li.is-leaving .session-entry)';

/** A press recorded in the page: `t` on the page clock, `during` true when an effect of the watched elements played. */
export interface Press {
  type: 'pointerdown' | 'keydown';
  key: string;
  t: number;
  during: boolean;
}

/**
 * Records each trusted press (pointer down, key down) with its page time and whether an element matching `selector`
 * then played a finite effect. A test that acts during an effect checks it here: from the runner, a loaded machine
 * adds its round trips to the app's time.
 */
export async function recordPresses(page: Page, selector: string): Promise<void> {
  await page.evaluate((watched) => {
    const presses: Press[] = [];
    (window as unknown as { __presses: Press[] }).__presses = presses;
    const playing = () =>
      [...document.querySelectorAll(watched)].some((element) =>
        element
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity),
      );
    for (const type of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(
        type,
        (event) => {
          if (!event.isTrusted) return;
          presses.push({ type, key: event instanceof KeyboardEvent ? event.key : '', t: performance.now(), during: playing() });
        },
        true,
      );
    }
  }, selector);
}

export const presses = (page: Page) => page.evaluate(() => (window as unknown as { __presses: Press[] }).__presses);
