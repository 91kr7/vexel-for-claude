import { useEffect, useRef, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { useLeaving } from '../motion/ExitPresence';
import { StateBadge } from '../sessions/StateBadge';
import { SubagentConversation } from './SubagentConversation';
import { type TurnSubagent, useTurn } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NAME = 'Turn Panel';

interface OpenedSubagent {
  subagent: TurnSubagent;
  opener: HTMLElement;
}

export function TurnPanel({ sessionId }: { sessionId: string }) {
  const state = useTurn(sessionId);
  const leaving = useLeaving();
  const [opened, setOpened] = useState<OpenedSubagent>();
  const returnFocusRef = useRef<HTMLElement | undefined>(undefined);
  const bodyRef = useRef<HTMLDivElement>(null);
  const turn = state.status === 'loaded' && state.turn.status !== 'none' ? state.turn : undefined;

  // The bar keeps the last values seen, also after the subagent leaves the tree.
  const live = opened && turn?.subagents.find((subagent) => subagent.id === opened.subagent.id);
  if (opened && live && live !== opened.subagent) setOpened({ ...opened, subagent: live });

  useEffect(() => {
    const opener = returnFocusRef.current;
    if (opened || !opener) return;
    returnFocusRef.current = undefined;
    if (opener.isConnected) opener.focus();
    else bodyRef.current?.querySelector<HTMLElement>('.turn-tree')?.focus();
  }, [opened]);

  const back = () => {
    returnFocusRef.current = opened?.opener;
    setOpened(undefined);
  };

  return (
    <section className={leaving ? 'turn-panel is-leaving' : 'turn-panel'} aria-label={NAME} aria-hidden={leaving || undefined}>
      <header className="turn-panel-header">
        <h3 className="turn-panel-title">Current Turn</h3>
        {turn && <StateBadge state={turn.status === 'running' ? 'working' : 'ended'} variant="chip" />}
      </header>
      <div ref={bodyRef} className={opened ? 'turn-panel-body is-covered' : 'turn-panel-body'}>
        {state.status === 'loading' && <AreaState kind="loading" size="compact" title="Loading…" className="turn-panel-state" />}
        {state.status === 'unavailable' && <AreaState kind="error" size="compact" title="Turn not available." className="turn-panel-state" />}
        {state.status === 'loaded' && !turn && <AreaState kind="empty" size="compact" title="No turn yet." className="turn-panel-state" />}
        {turn && <TurnTreeView key={turn.number} turn={turn} onOpenSubagent={(subagent, opener) => setOpened({ subagent, opener })} />}
        {opened && <SubagentConversation key={opened.subagent.id} sessionId={sessionId} subagent={opened.subagent} onBack={back} />}
      </div>
    </section>
  );
}
