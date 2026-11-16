import { MinusIcon, PlusIcon } from '../icons/Icons';
import { rowKeysText } from '../shortcut-map';
import { useUserShortcutKeys } from '../user-shortcut-keys';
import { MAX_TERMINAL_FONT_SIZE, MIN_TERMINAL_FONT_SIZE } from './terminal-font-size-store';

interface TerminalZoomControlsProps {
  size: number;
  onSmaller: () => void;
  onReset: () => void;
  onLarger: () => void;
}

export function TerminalZoomControls({ size, onSmaller, onReset, onLarger }: TerminalZoomControlsProps) {
  useUserShortcutKeys();
  return (
    <div className="terminal-zoom" role="group" aria-label="Terminal text size">
      <button
        type="button"
        className="terminal-zoom-button"
        aria-label="Smaller text"
        title={`Smaller text (${rowKeysText('terminal-smaller-text')})`}
        disabled={size <= MIN_TERMINAL_FONT_SIZE}
        onClick={onSmaller}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="terminal-zoom-size"
        aria-label={`Default text size (${size} px)`}
        title={`Default text size (${rowKeysText('terminal-default-text')})`}
        onClick={onReset}
      >
        {size} px
      </button>
      <button
        type="button"
        className="terminal-zoom-button"
        aria-label="Larger text"
        title={`Larger text (${rowKeysText('terminal-larger-text')})`}
        disabled={size >= MAX_TERMINAL_FONT_SIZE}
        onClick={onLarger}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
