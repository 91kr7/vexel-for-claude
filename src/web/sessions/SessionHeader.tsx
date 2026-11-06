import { type ReactNode, useId } from 'react';
import { folderNameOf } from './Avatar';
import type { ContextOccupancy, CostTotal, SessionSummary, TokenTotals } from './live-session-store';
import { StateBadge } from './StateBadge';
import { costText, INCOMPLETE_COST_TEXT, percentOf, shortTokens, usageLevelOf } from './usage-format';

export type SessionHeaderSummary = Pick<SessionSummary, 'folder' | 'label' | 'state' | 'usage'>;

function ContextChip({ context }: { context: ContextOccupancy }) {
  const percent = percentOf(context);
  return (
    <span className="mono-chip vx-surface-2 session-header-context">
      <span className="session-header-context-label">Context</span>
      <span className={`usage-${usageLevelOf(percent)}`}>
        {`${shortTokens(context.used)} / ${shortTokens(context.window)} · ${percent}%`}
      </span>
    </span>
  );
}

const TOKEN_PARTS: [label: string, part: keyof TokenTotals][] = [
  ['Input', 'input'],
  ['Output', 'output'],
  ['Cache write', 'cacheWrite'],
  ['Cache read', 'cacheRead'],
];

function TokensChip({ tokens }: { tokens: TokenTotals }) {
  const popoverId = useId();
  const total = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead;
  return (
    <span className="mono-chip vx-surface-2 session-header-tokens" tabIndex={0} aria-describedby={popoverId}>
      {`${shortTokens(total)} tokens`}
      <span className="session-header-tokens-popover" id={popoverId} role="tooltip">
        {TOKEN_PARTS.map(([label, part]) => (
          <span className="session-header-tokens-part" key={part}>
            <span className="session-header-tokens-label">{label}</span>
            <span>{shortTokens(tokens[part])}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function CostChip({ cost }: { cost: CostTotal }) {
  return (
    <span className="mono-chip vx-surface-2 session-header-cost">
      <span>{costText(cost.usd)}</span>
      {cost.incomplete && (
        <span className="usage-incomplete" role="img" aria-label={INCOMPLETE_COST_TEXT} title={INCOMPLETE_COST_TEXT}>
          incomplete
        </span>
      )}
      <span className="session-header-cost-label">· estimate at API list prices</span>
    </span>
  );
}

interface SessionHeaderProps {
  session?: SessionHeaderSummary;
  actions: ReactNode;
  notice?: ReactNode;
  line?: string;
}

export function SessionHeader({ session, actions, notice, line }: SessionHeaderProps) {
  const name = session && folderNameOf(session.folder);
  const subtitle = session && (line ?? session.label);
  return (
    <header className="session-header">
      <div className="session-header-info">
        {session && (
          <>
            <h2 className="session-header-name" title={name}>
              {name}
            </h2>
            <span className="session-header-separator" aria-hidden="true">
              /
            </span>
            <span className="session-header-path" title={session.folder}>
              {session.folder}
            </span>
            {subtitle && (
              <span className="mono-chip vx-surface-2 session-header-subtitle" title={subtitle}>
                {subtitle}
              </span>
            )}
          </>
        )}
      </div>
      <div className="session-header-actions">
        {session?.usage?.context && <ContextChip context={session.usage.context} />}
        {session?.usage?.tokens && <TokensChip tokens={session.usage.tokens} />}
        {session?.usage?.cost && <CostChip cost={session.usage.cost} />}
        {session && <StateBadge state={session.state} variant="chip" />}
        {notice}
        {actions}
      </div>
    </header>
  );
}
