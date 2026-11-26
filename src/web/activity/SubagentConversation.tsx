import { type KeyboardEvent, useEffect, useRef } from 'react';
import { ConversationBody } from '../external/ConversationBody';
import { ArrowLeftIcon } from '../icons/Icons';
import { SubagentStatePill } from './SubagentCard';
import type { TurnSubagent } from './turn-store';

interface SubagentConversationProps {
  sessionId: string;
  subagent: TurnSubagent;
  onBack: () => void;
}

export function SubagentConversation({ sessionId, subagent, onBack }: SubagentConversationProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const { type, description, state } = subagent;
  const apiPath = `/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(subagent.id)}`;

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onBack();
  };

  return (
    <section className="subagent-conversation" aria-label="Subagent Conversation" onKeyDown={onKeyDown}>
      <div className="subagent-conversation-bar">
        <button ref={backRef} type="button" className="button-neutral" onClick={onBack}>
          <ArrowLeftIcon />
          Back
        </button>
        {type && (
          <span className="mono-chip subagent-conversation-type" title={type}>
            {type}
          </span>
        )}
        <span className="subagent-conversation-description" title={description}>
          {description}
        </span>
        <SubagentStatePill state={state} />
      </div>
      <ConversationBody streamPath={`${apiPath}/conversation`} contentPath={`${apiPath}/items`} userName="Task" userAvatar="T" />
    </section>
  );
}
