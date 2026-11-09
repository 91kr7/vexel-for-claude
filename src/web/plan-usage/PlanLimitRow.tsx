import { usageLevelOf } from '../sessions/usage-format';
import { isValidResetTime, remainingText, resetDateText } from './reset-time-format';
import type { PlanLimit } from './plan-usage-store';

export function PlanLimitRow({ limit, nowMs }: { limit: PlanLimit; nowMs: number }) {
  const level = usageLevelOf(limit.percent);
  const barPercent = Math.min(100, Math.max(0, limit.percent));
  const resetsAt = limit.resetsAt !== null && isValidResetTime(limit.resetsAt) ? limit.resetsAt : undefined;
  return (
    <li className="plan-limit">
      <div className="plan-limit-head">
        <span className="plan-limit-label">{limit.label}</span>
        <span className={`plan-limit-percent usage-${level}`}>{`${limit.percent}%`}</span>
      </div>
      <div
        className="plan-limit-bar"
        role="progressbar"
        aria-label={limit.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={barPercent}
      >
        <div className={`plan-limit-fill usage-${level}`} style={{ width: `${barPercent}%` }} />
      </div>
      {resetsAt !== undefined && (
        <p className="plan-limit-reset">{`Resets in ${remainingText(resetsAt, nowMs)} · ${resetDateText(resetsAt)}`}</p>
      )}
    </li>
  );
}
