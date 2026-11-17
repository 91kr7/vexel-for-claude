import { motionDurationMs } from '../motion/ExitPresence';

// Longest wait for the areas that recolour after the change (terminal, commit graph) before the new colours are captured.
const SETTLE_LIMIT_MS = 100;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, SETTLE_LIMIT_MS);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Runs `apply` (a theme or look change) as a cross-fade of the whole page from the old colours to the new ones.
 * Applies it at once with reduced motion or where the browser has no view transitions.
 */
export function dissolveColors(apply: () => void): void {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    apply();
    return;
  }
  if (motionDurationMs('--motion-duration-enter') === 0) {
    apply();
    return;
  }
  const transition = document.startViewTransition(async () => {
    apply();
    await nextFrame();
  });
  // A newer change skips this dissolve: its rejection is expected.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  transition.finished.catch(() => undefined);
}
