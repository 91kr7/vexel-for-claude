import { useLayoutEffect, useMemo, useRef } from 'react';
import { AreaState } from '../feedback/AreaState';
import { SubagentCard } from './SubagentCard';
import type { SubagentGroup, TurnSubagent, TurnTree } from './turn-store';

const AT_END_TOLERANCE_PX = 8;

const isAtEnd = (element: HTMLElement) => element.scrollHeight - element.scrollTop - element.clientHeight <= AT_END_TOLERANCE_PX;

type OpenSubagent = (subagent: TurnSubagent, opener: HTMLElement) => void;

interface GroupProps {
  group: SubagentGroup;
  subagents: ReadonlyMap<string, TurnSubagent>;
  onOpen?: OpenSubagent;
}

function Group({ group, subagents, onOpen }: GroupProps) {
  const members = group.subagents.flatMap((id) => subagents.get(id) ?? []);
  const joined = members.length > 1;
  return (
    <div className="subagent-group">
      {members.map((subagent) => (
        <div key={subagent.id} className="subagent-member">
          {joined && <span className="subagent-line" aria-hidden="true" />}
          {joined && <span className="subagent-tick" aria-hidden="true" />}
          <SubagentCard subagent={subagent} onOpen={onOpen} />
          {subagent.groups.map((nested, index) => (
            <Group key={index} group={nested} subagents={subagents} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  );
}

function latestStartedOf(subagents: readonly TurnSubagent[]): string | undefined {
  let latest: { id: string; time: number } | undefined;
  for (const { id, startedAt } of subagents) {
    const time = startedAt === undefined ? Number.NaN : Date.parse(startedAt);
    if (!Number.isNaN(time) && (!latest || time >= latest.time)) latest = { id, time };
  }
  return latest?.id;
}

// Page order of the rows, as Group renders them: each row comes before the rows nested under it.
function cardOrderOf(turn: TurnTree, subagents: ReadonlyMap<string, TurnSubagent>): string[] {
  const order: string[] = [];
  const visit = (ids: readonly string[]) => {
    for (const id of ids) {
      const subagent = subagents.get(id);
      if (!subagent) continue;
      order.push(id);
      for (const group of subagent.groups) visit(group.subagents);
    }
  };
  for (const group of turn.groups) visit(group.subagents);
  return order;
}

function reveal(view: HTMLElement, card: Element): void {
  const viewTop = view.getBoundingClientRect().top;
  const { top, bottom } = card.getBoundingClientRect();
  if (top < viewTop || bottom - top > view.clientHeight) view.scrollTop += top - viewTop;
  else if (bottom > viewTop + view.clientHeight) view.scrollTop += bottom - viewTop - view.clientHeight;
}

export function TurnTreeView({ turn, onOpenSubagent }: { turn: TurnTree; onOpenSubagent?: OpenSubagent }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const scrollTopRef = useRef(0);
  const subagents = useMemo(() => new Map(turn.subagents.map((subagent) => [subagent.id, subagent])), [turn.subagents]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const latest = latestStartedOf(turn.subagents);
    if (followRef.current && latest !== undefined) {
      const card = element.querySelectorAll('.subagent-card')[cardOrderOf(turn, subagents).indexOf(latest)];
      if (card) reveal(element, card);
    }
    scrollTopRef.current = element.scrollTop;
  }, [turn, subagents]);

  // A scroll to the place recorded above is the view's own, or the content moving: only the user's scrolls count.
  const onScroll = () => {
    const element = scrollRef.current;
    if (!element || element.scrollTop === scrollTopRef.current) return;
    if (isAtEnd(element)) followRef.current = true;
    else if (element.scrollTop < scrollTopRef.current) followRef.current = false;
    scrollTopRef.current = element.scrollTop;
  };

  return (
    <div className="turn-tree" ref={scrollRef} tabIndex={0} onScroll={onScroll}>
      {turn.groups.length > 0 ? (
        turn.groups.map((group, index) => <Group key={index} group={group} subagents={subagents} onOpen={onOpenSubagent} />)
      ) : (
        <AreaState kind="empty" size="compact" title="No subagents running." />
      )}
    </div>
  );
}
