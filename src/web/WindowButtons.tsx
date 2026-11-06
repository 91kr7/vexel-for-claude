import type { MouseEvent } from 'react';
import { closeWindow, minimizeWindow, toggleMaximizeWindow, useWindowMaximized } from './desktop-bridge';
import { Maximize2Icon, Minimize2Icon, MinusIcon, XIcon } from './icons/Icons';

// A click must not take the focus, so an open dialog keeps it.
function keepFocus(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function WindowButtons() {
  const maximized = useWindowMaximized();
  return (
    <div className="window-buttons">
      <button type="button" className="window-button window-close" aria-label="Close" onMouseDown={keepFocus} onClick={closeWindow}>
        <XIcon />
      </button>
      <button type="button" className="window-button window-minimize" aria-label="Minimize" onMouseDown={keepFocus} onClick={minimizeWindow}>
        <MinusIcon />
      </button>
      <button
        type="button"
        className="window-button window-maximize"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onMouseDown={keepFocus}
        onClick={toggleMaximizeWindow}
      >
        {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
      </button>
    </div>
  );
}
