import { useId } from 'react';
import type { ContextOccupancy, CostTotal, SessionUsage, TokenTotals } from './live-session-store';
import { costText, INCOMPLETE_COST_TEXT, percentOf, shortTokens, usageLevelOf } from './usage-format';

function ContextChip({ context }: { context: ContextOccupancy }) {
  const percent = percentOf(context);
  return (
    <span className="mono-chip vx-surface-2 session-figure-context">
      <span className="session-figure-label">Context</span>
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
  const tooltipId = useId();
  const total = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead;
  return (
    <span className="mono-chip vx-surface-2 session-figure-tokens" tabIndex={0} aria-describedby={tooltipId}>
      {`${shortTokens(total)} tokens`}
      <span className="session-figure-tokens-tooltip" id={tooltipId} role="tooltip">
        {TOKEN_PARTS.map(([label, part]) => (
          <span className="session-figure-tokens-part" key={part}>
            <span className="session-figure-label">{label}</span>
            <span>{shortTokens(tokens[part])}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function CostChip({ cost }: { cost: CostTotal }) {
  return (
    <span className="mono-chip vx-surface-2 session-figure-cost">
      <span title="Estimated cost at API list prices">{costText(cost.usd)}</span>
      {cost.incomplete && (
        <span className="usage-incomplete" role="img" aria-label={INCOMPLETE_COST_TEXT} title={INCOMPLETE_COST_TEXT}>
          incomplete
        </span>
      )}
    </span>
  );
}

export function SessionFigures({ usage }: { usage?: SessionUsage }) {
  if (!usage) return null;
  return (
    <span className="session-figures">
      {usage.context && <ContextChip context={usage.context} />}
      {usage.tokens && <TokensChip tokens={usage.tokens} />}
      {usage.cost && <CostChip cost={usage.cost} />}
    </span>
  );
}
