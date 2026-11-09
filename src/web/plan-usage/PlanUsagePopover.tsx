import type { KeyboardEvent } from 'react';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { XIcon } from '../icons/Icons';
import { PlanLimitRow } from './PlanLimitRow';
import { lastReadText } from './reset-time-format';
import type { PlanUsageState } from './plan-usage-store';

interface PlanUsagePopoverProps {
  state: PlanUsageState;
  onClose: () => void;
}

function Content({ state }: { state: PlanUsageState }) {
  if (state.kind === 'loading') return <ProgressIndicator />;
  if (state.kind === 'unavailable') return <p className="plan-usage-message">Plan usage is not available</p>;
  if (state.kind === 'stale') {
    return (
      <>
        <p className="plan-usage-message">Could not refresh the plan usage</p>
        <p className="plan-usage-note">{`Last read at ${lastReadText(state.lastReadAt)}`}</p>
      </>
    );
  }
  return (
    <ul className="plan-limits">
      {state.limits.map((limit) => (
        <PlanLimitRow key={limit.label} limit={limit} nowMs={state.readAt} />
      ))}
    </ul>
  );
}

export function PlanUsagePopover({ state, onClose }: PlanUsagePopoverProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };
  return (
    <section className="plan-usage-popover vx-surface-1" role="dialog" aria-label="Plan Usage" onKeyDown={handleKeyDown}>
      <header className="plan-usage-header">
        <h2 className="plan-usage-title">Plan Usage</h2>
        <button type="button" className="plan-usage-close" aria-label="Close" onClick={onClose}>
          <XIcon />
        </button>
      </header>
      <Content state={state} />
    </section>
  );
}
