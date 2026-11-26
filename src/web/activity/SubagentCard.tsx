import type { ReactNode } from 'react';
import type { RunningTool } from '../sessions/live-session-store';
import { ElapsedTime } from './ElapsedTime';
import { shortDuration } from './short-duration';
import type { SubagentState, TurnSubagent } from './turn-store';

const STATE_NAMES: Record<SubagentState, string> = { running: 'Running', finished: 'Finished', stopped: 'Stopped' };

function Duration({ subagent }: { subagent: TurnSubagent }) {
  const { startedAt, endedAt, state } = subagent;
  if (startedAt === undefined) return null;
  if (state === 'running') return <ElapsedTime since={startedAt} />;
  const runMs = endedAt === undefined ? Number.NaN : Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isNaN(runMs) ? null : <>{shortDuration(runMs)}</>;
}

function CurrentTool({ tool }: { tool?: RunningTool }) {
  const text = tool === undefined ? '' : tool.argument === undefined ? tool.name : `${tool.name}: ${tool.argument}`;
  const others = tool !== undefined && tool.others > 0 ? `+${tool.others}` : undefined;
  return (
    <span className="subagent-card-tool" title={others ? `${text} ${others}` : text || undefined}>
      <span className="subagent-card-tool-text">{text}</span>
      {others && <span className="subagent-card-tool-others">{others}</span>}
    </span>
  );
}

interface SubagentCardProps {
  subagent: TurnSubagent;
  children?: ReactNode;
}

export function SubagentCard({ subagent, children }: SubagentCardProps) {
  const { type, description, model, state, latestText } = subagent;
  return (
    <article className="subagent-card" aria-label={type ? `Subagent: ${type}` : 'Subagent'}>
      <div className="subagent-card-head">
        <span className={type ? 'mono-chip subagent-card-type' : 'subagent-card-type'} title={type}>
          {type}
        </span>
        <span className={`status-pill subagent-state subagent-state-${state}`}>{STATE_NAMES[state]}</span>
      </div>
      <p className="subagent-card-description" title={description}>
        {description}
      </p>
      <div className="subagent-card-meta">
        <span className="subagent-card-model" title={model}>
          {model}
        </span>
        <span className="subagent-card-duration">
          <Duration subagent={subagent} />
        </span>
      </div>
      <p className="subagent-card-text" title={latestText}>
        {latestText}
      </p>
      <CurrentTool tool={subagent.currentTool} />
      {children}
    </article>
  );
}
