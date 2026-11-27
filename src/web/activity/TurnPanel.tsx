import { useEffect, useRef, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { useLeaving } from '../motion/ExitPresence';
import { SubagentConversation } from './SubagentConversation';
import { type TurnSubagent, useTurn } from './turn-store';
import { TurnTreeView } from './TurnTreeView';

const NAME = 'Subagents';

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
  const turn = state.status === 'loaded' ? state.turn : undefined;

  // After the subagent leaves the tree, the bar keeps its last type and description.
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
        <h3 className="turn-panel-title">{NAME}</h3>
      </header>
      <div ref={bodyRef} className={opened ? 'turn-panel-body is-covered' : 'turn-panel-body'}>
        {state.status === 'loading' && <AreaState kind="loading" size="compact" title="Loading…" className="turn-panel-state" />}
        {state.status === 'unavailable' && <AreaState kind="error" size="compact" title="Subagents not available." className="turn-panel-state" />}
        {turn && <TurnTreeView turn={turn} onOpenSubagent={(subagent, opener) => setOpened({ subagent, opener })} />}
        {opened && <SubagentConversation key={opened.subagent.id} sessionId={sessionId} subagent={opened.subagent} leftList={!live} onBack={back} />}
      </div>
    </section>
  );
}
