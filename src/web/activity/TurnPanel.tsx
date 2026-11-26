import { AreaState } from '../feedback/AreaState';
import { useLeaving } from '../motion/ExitPresence';
import { StateBadge } from '../sessions/StateBadge';
import { useTurn } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NAME = 'Turn Panel';

export function TurnPanel({ sessionId }: { sessionId: string }) {
  const state = useTurn(sessionId);
  const leaving = useLeaving();
  const turn = state.status === 'loaded' && state.turn.status !== 'none' ? state.turn : undefined;
  return (
    <section className={leaving ? 'turn-panel is-leaving' : 'turn-panel'} aria-label={NAME} aria-hidden={leaving || undefined}>
      <header className="turn-panel-header">
        <h3 className="turn-panel-title">Current Turn</h3>
        {turn && <StateBadge state={turn.status === 'running' ? 'working' : 'ended'} variant="chip" />}
      </header>
      {state.status === 'loading' && <AreaState kind="loading" size="compact" title="Loading…" className="turn-panel-state" />}
      {state.status === 'unavailable' && <AreaState kind="error" size="compact" title="Turn not available." className="turn-panel-state" />}
      {state.status === 'loaded' && !turn && <AreaState kind="empty" size="compact" title="No turn yet." className="turn-panel-state" />}
      {turn && <TurnTreeView key={turn.number} turn={turn} />}
    </section>
  );
}
