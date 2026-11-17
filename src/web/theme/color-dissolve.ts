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

const POINTER_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const;

/**
 * During a view transition the browser sends every pointer event to the root. A press ends the dissolve and
 * sends the events of that press again to the element under the pointer.
 */
function forwardPointerDuring(transition: ViewTransition): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  const root = document.documentElement;
  let target: Element | null = null;
  const forward = (event: Event) => {
    if (!(event instanceof MouseEvent) || !event.isTrusted || event.target !== root) return;
    if (event.type === 'pointerdown') {
      transition.skipTransition();
      target = document.elementFromPoint(event.clientX, event.clientY);
    }
    if (target === null || target === root) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const copy = event instanceof PointerEvent ? new PointerEvent(event.type, event) : new MouseEvent(event.type, event);
    if (event.type === 'mousedown') target.closest<HTMLElement>('button, a, input, select, textarea, [tabindex]')?.focus();
    target.dispatchEvent(copy);
    if (event.type === 'click') target = null;
  };
  for (const type of POINTER_EVENTS) window.addEventListener(type, forward, true);
  const stop = () => {
    // Waits for the rest of a press that ended the dissolve.
    setTimeout(() => {
      for (const type of POINTER_EVENTS) window.removeEventListener(type, forward, true);
    }, target === null ? 0 : 1000);
  };
  transition.finished.then(stop, stop);
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
  forwardPointerDuring(transition);
  // A newer change skips this dissolve: its rejection is expected.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  transition.finished.catch(() => undefined);
}
