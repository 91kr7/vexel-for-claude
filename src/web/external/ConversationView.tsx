import { type Ref, useState } from 'react';
import { TurnPanel } from '../activity/TurnPanel';
import { TurnPanelButton } from '../activity/TurnPanelButton';
import { GitExplorerButton } from '../git/GitExplorerButton';
import { GitExplorerPanel } from '../git/GitExplorerPanel';
import { ExitPresence } from '../motion/ExitPresence';
import { useRepositoryLookup } from '../git/repository-lookup-store';
import { LockIcon } from '../icons/Icons';
import { SessionFooter } from '../sessions/SessionFooter';
import type { SessionSummary } from '../sessions/live-session-store';
import { SessionHeader, type SessionHeaderSummary } from '../sessions/SessionHeader';
import { ConversationBody } from './ConversationBody';
import { ResumeHereButton } from './ResumeHereButton';

export { formatMessageTime } from './ConversationBody';

interface ConversationViewProps {
  sessionId: string;
  session?: SessionHeaderSummary;
  sessions?: readonly SessionSummary[];
  onResumed: (id: string) => void;
  focusRef?: Ref<{ focus(): void }>;
}

export function ConversationView({ sessionId, session, sessions, onResumed, focusRef }: ConversationViewProps) {
  const apiPath = `/api/external-sessions/${encodeURIComponent(sessionId)}`;
  const [gitRevision, setGitRevision] = useState(0);
  const repository = useRepositoryLookup(session?.folder, gitRevision);
  const [gitOpen, setGitOpen] = useState(false);
  const gitShown = gitOpen && (repository.status === 'repositories' || repository.status === 'error');
  const [turnOpen, setTurnOpen] = useState(false);
  const refreshGit = () => setGitRevision((revision) => revision + 1);
  const toggleGit = () => {
    if (!gitShown) {
      refreshGit();
      setTurnOpen(false);
    }
    setGitOpen(!gitShown);
  };
  const toggleTurn = () => {
    if (!turnOpen) setGitOpen(false);
    setTurnOpen(!turnOpen);
  };

  return (
    <div className="conversation-view">
      <SessionHeader
        session={session}
        actions={
          <>
            <GitExplorerButton lookup={repository} open={gitShown} onToggle={toggleGit} />
            <TurnPanelButton open={turnOpen} onToggle={toggleTurn} />
            <ResumeHereButton sessionId={sessionId} onResumed={onResumed} ended={session?.state === 'ended'} />
          </>
        }
        notice={
          <span className="mono-chip vx-surface-2 read-only-chip">
            <LockIcon />
            Read-only
          </span>
        }
      />
      <div className="session-workspace">
        <ConversationBody streamPath={`${apiPath}/conversation`} contentPath={`${apiPath}/items`} focusRef={focusRef} />
        <ExitPresence>
          {gitShown && <GitExplorerPanel lookup={repository} folder={session?.folder} onRefresh={refreshGit} sessions={sessions} />}
        </ExitPresence>
        <ExitPresence>{turnOpen && <TurnPanel sessionId={sessionId} />}</ExitPresence>
      </div>
      <SessionFooter session={session} lead="Open in Another Terminal · " />
    </div>
  );
}
