import type { MouseEvent } from 'react';
import { closeWindow, minimizeWindow, toggleMaximizeWindow, useWindowMaximized } from './desktop-bridge';
import {
  CaptionCloseGlyph,
  CaptionMaximizeGlyph,
  CaptionMinimizeGlyph,
  CaptionRestoreGlyph,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  XIcon,
} from './icons/Icons';
import type { Look } from './theme/look-store';

// A click must not take the focus, so an open dialog keeps it.
function keepFocus(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function WindowButtons({ look = 'vexel' }: { look?: Look }) {
  const maximized = useWindowMaximized();
  const maximizeLabel = maximized ? 'Restore' : 'Maximize';

  if (look === 'windows11') {
    return (
      <div className="caption-buttons">
        <button type="button" className="caption-button" aria-label="Minimize" onMouseDown={keepFocus} onClick={minimizeWindow}>
          <CaptionMinimizeGlyph />
        </button>
        <button type="button" className="caption-button" aria-label={maximizeLabel} onMouseDown={keepFocus} onClick={toggleMaximizeWindow}>
          {maximized ? <CaptionRestoreGlyph /> : <CaptionMaximizeGlyph />}
        </button>
        <button type="button" className="caption-button caption-close" aria-label="Close" onMouseDown={keepFocus} onClick={closeWindow}>
          <CaptionCloseGlyph />
        </button>
      </div>
    );
  }

  return (
    <div className="window-buttons">
      <button type="button" className="window-button window-close" aria-label="Close" onMouseDown={keepFocus} onClick={closeWindow}>
        <XIcon />
      </button>
      <button type="button" className="window-button window-minimize" aria-label="Minimize" onMouseDown={keepFocus} onClick={minimizeWindow}>
        <MinusIcon />
      </button>
      <button type="button" className="window-button window-maximize" aria-label={maximizeLabel} onMouseDown={keepFocus} onClick={toggleMaximizeWindow}>
        {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
      </button>
    </div>
  );
}
