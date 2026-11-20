import type { KeyboardEvent } from 'react';
import { ProgressIndicator } from '../feedback/ProgressIndicator';
import { XIcon } from '../icons/Icons';
import { useLeaving } from '../motion/ExitPresence';
import { PlanLimitRow } from './PlanLimitRow';
import type { PlanUsageState } from './plan-usage-store';

interface PlanUsagePopoverProps {
  state: PlanUsageState;
  onClose: () => void;
}

function Content({ state }: { state: PlanUsageState }) {
  if (state.kind === 'loading') return <ProgressIndicator />;
  if (state.kind === 'unavailable') return <p className="plan-usage-message">Plan usage is not available</p>;
  return (
    <ul className="plan-limits">
      {state.limits.map((limit) => (
        <PlanLimitRow key={limit.label} limit={limit} nowMs={state.readAt} />
      ))}
    </ul>
  );
}

export function PlanUsagePopover({ state, onClose }: PlanUsagePopoverProps) {
  const leaving = useLeaving();
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (leaving || event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };
  return (
    <section
      className={leaving ? 'plan-usage-popover vx-surface-1 vx-popup-glass is-leaving' : 'plan-usage-popover vx-surface-1 vx-popup-glass'}
      role="dialog"
      aria-label="Plan Usage"
      aria-hidden={leaving || undefined}
      onKeyDown={handleKeyDown}
    >
      <header className="plan-usage-header">
        <h2 className="plan-usage-title">Plan Usage</h2>
        <button type="button" className="plan-usage-close" aria-label="Close" onClick={leaving ? undefined : onClose}>
          <XIcon />
        </button>
      </header>
      <Content state={state} />
    </section>
  );
}
