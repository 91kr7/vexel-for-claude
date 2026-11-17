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
