import { ListTreeIcon } from '../icons/Icons';

const NAME = 'Subagents';

interface TurnPanelButtonProps {
  open: boolean;
  onToggle: () => void;
}

export function TurnPanelButton({ open, onToggle }: TurnPanelButtonProps) {
  return (
    <button
      type="button"
      className={open ? 'session-search-button turn-panel-button open' : 'session-search-button turn-panel-button'}
      aria-label={NAME}
      title={NAME}
      aria-expanded={open}
      onClick={onToggle}
    >
      <ListTreeIcon />
    </button>
  );
}
