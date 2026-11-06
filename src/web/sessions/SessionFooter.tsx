import type { ReactNode } from 'react';
import type { SessionSummary } from './live-session-store';
import { SessionFigures } from './SessionFigures';

interface SessionFooterProps {
  session?: Pick<SessionSummary, 'folder' | 'usage'>;
  lead?: string;
  end?: ReactNode;
}

export function SessionFooter({ session, lead, end }: SessionFooterProps) {
  return (
    <footer className="session-footer">
      {session && (
        <>
          <span className="session-footer-place" title={session.folder}>
            {lead && <span className="session-footer-lead">{lead}</span>}
            <span className="session-footer-path">{session.folder}</span>
          </span>
          <SessionFigures usage={session.usage} />
        </>
      )}
      {end && <div className="session-footer-end">{end}</div>}
    </footer>
  );
}
