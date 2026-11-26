import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SubagentCard } from './SubagentCard';
import type { SubagentGroup, ToolOutcome, TurnStep, TurnSubagent, TurnTree } from './turn-store';

const STEP_PAGE = 200;
const AT_END_TOLERANCE_PX = 8;
const OUTCOME_NAMES: Record<ToolOutcome, string> = { running: 'Running', completed: 'Completed', error: 'Error' };

const isAtEnd = (element: HTMLElement) => element.scrollHeight - element.scrollTop - element.clientHeight <= AT_END_TOLERANCE_PX;

const lastPageStart = (length: number) => Math.max(0, length - STEP_PAGE);

function Group({ ids, subagents }: { ids: readonly string[]; subagents: ReadonlyMap<string, TurnSubagent> }) {
  return (
    <div className="subagent-group">
      {ids.map((id) => {
        const subagent = subagents.get(id);
        return (
          subagent && (
            <SubagentCard key={id} subagent={subagent}>
              {subagent.groups.map((nested) => (
                <Group key={nested.step} ids={nested.subagents} subagents={subagents} />
              ))}
            </SubagentCard>
          )
        );
      })}
    </div>
  );
}

function StepRow({ step }: { step: TurnStep }) {
  if (step.kind === 'text') return <p className="turn-step-text">{step.text}</p>;
  return (
    <div className="turn-step-tool">
      {step.name && <span className="turn-step-name">{step.name}</span>}
      <span className="turn-step-argument" title={step.argument}>
        {step.argument}
      </span>
      {step.outcome && <span className={`turn-step-outcome turn-step-outcome-${step.outcome}`}>{OUTCOME_NAMES[step.outcome]}</span>}
    </div>
  );
}

export function TurnTreeView({ turn }: { turn: TurnTree }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const length = turn.steps.length;
  const [start, setStart] = useState(() => lastPageStart(length));
  const subagents = useMemo(() => new Map(turn.subagents.map((subagent) => [subagent.id, subagent])), [turn.subagents]);
  const groups = useMemo(() => new Map<number, SubagentGroup>(turn.groups.map((group) => [group.step, group])), [turn.groups]);
  const hidden = Math.min(start, STEP_PAGE);

  useLayoutEffect(() => {
    if (followRef.current && length - start > STEP_PAGE) setStart(lastPageStart(length));
  }, [length, start]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && followRef.current) element.scrollTop = element.scrollHeight;
  }, [turn, start]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (element) followRef.current = isAtEnd(element);
  };

  return (
    <div className="turn-tree" ref={scrollRef} tabIndex={0} onScroll={onScroll}>
      {turn.earlier.length > 0 && (
        <section className="turn-earlier" aria-label="Still running from earlier turns">
          <h4 className="turn-section-title">Still running from earlier turns</h4>
          <Group ids={turn.earlier} subagents={subagents} />
        </section>
      )}
      {start > 0 && (
        <button type="button" className="button-neutral turn-earlier-steps" onClick={() => setStart((current) => Math.max(0, current - STEP_PAGE))}>
          {hidden === 1 ? 'Show 1 earlier step' : `Show ${hidden} earlier steps`}
        </button>
      )}
      <ol className="turn-steps">
        {turn.steps.slice(start).map((step, offset) => {
          const index = start + offset;
          const group = groups.get(index);
          return (
            <li key={index} className="turn-step">
              <StepRow step={step} />
              {group && <Group ids={group.subagents} subagents={subagents} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
