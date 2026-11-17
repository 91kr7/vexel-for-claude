import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const LeavingContext = createContext(false);

/** True while the element is closed and plays its exit effect. */
export function useLeaving(): boolean {
  return useContext(LeavingContext);
}

// A motion token in ms: 0 with reduced motion, and unset where no style sheet is loaded.
export function motionDurationMs(token: '--motion-duration-enter' | '--motion-duration-exit' | '--motion-cascade-max'): number {
  if (typeof document === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return value.endsWith('ms') ? amount : amount * 1000;
}

// Nothing to show: what `{condition && <X />}` gives for a false condition.
function isShown(children: ReactNode): boolean {
  return children !== null && children !== undefined && typeof children !== 'boolean' && children !== '' && children !== 0;
}

export function ExitPresence({ children }: { children: ReactNode }) {
  const parentLeaving = useContext(LeavingContext);
  const shown = isShown(children);
  const lastShown = useRef<ReactNode>(null);
  const [wasShown, setWasShown] = useState(shown);
  const [openCount, setOpenCount] = useState(0);
  const [exitMs, setExitMs] = useState(0);

  if (shown !== wasShown) {
    setWasShown(shown);
    if (shown) setOpenCount((count) => count + 1);
    else setExitMs(motionDurationMs('--motion-duration-exit'));
  }
  if (shown) lastShown.current = children;

  const leaving = !shown && exitMs > 0;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setExitMs(0), exitMs);
    return () => clearTimeout(timer);
  }, [leaving, exitMs]);

  if (!shown && !leaving) return null;
  return (
    <LeavingContext.Provider key={openCount} value={parentLeaving || leaving}>
      {shown ? children : lastShown.current}
    </LeavingContext.Provider>
  );
}
