import type { ExternalSessionScanner } from '../external/external-session-scanner.js';
import { type TranscriptReader, subagentFileOf } from '../external/transcript-reader.js';
import type { SessionStateTracker } from '../sessions/session-state-tracker.js';

export interface SubagentFileSources {
  tracker: Pick<SessionStateTracker, 'get' | 'claudeSessionId'>;
  scanner: Pick<ExternalSessionScanner, 'get'>;
  reader: Pick<TranscriptReader, 'locate'>;
}

export async function locateSubagentFile(
  { tracker, scanner, reader }: SubagentFileSources,
  sessionId: string,
  agentId: string,
): Promise<string | undefined> {
  const hosted = tracker.get(sessionId);
  const session = hosted ?? scanner.get(sessionId);
  const claudeSessionId = hosted ? tracker.claudeSessionId(sessionId) : sessionId;
  if (!session || claudeSessionId === undefined) return undefined;
  const transcript = await reader.locate(session.folder, claudeSessionId);
  return transcript && subagentFileOf(transcript, agentId);
}
