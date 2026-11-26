import type { AttentionEvent, WaitingDetail } from './attention-client.js';
import { notificationTitle } from './notification-texts.js';
import type { NtfyMessage } from './ntfy-publisher.js';

export const REMOTE_BODY_MAX_BYTES = 4_096;
export const REMOTE_PRIORITY_HIGH = 4;
export const SHORTENED_LINE = '[Text shortened]';

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

function questionsText(detail: Extract<WaitingDetail, { kind: 'questions' }>): string {
  return detail.questions.flatMap(({ question, options }) => [question, ...options.map((option) => `- ${option}`)]).join('\n');
}

function leadAndDetail(event: AttentionEvent): { lead: string; detail: string } {
  if (event.waitingDetail?.kind === 'questions') return { lead: 'Claude asks:', detail: questionsText(event.waitingDetail) };
  if (event.waitingTool) {
    const detail = event.waitingDetail?.kind === 'argument' ? event.waitingDetail.text : '';
    return { lead: `Permission for ${event.waitingTool}`, detail };
  }
  return { lead: 'Needs your input', detail: '' };
}

function cutToBytes(text: string, maxBytes: number): string {
  let cut = '';
  let bytes = 0;
  for (const character of text) {
    bytes += byteLength(character);
    if (bytes > maxBytes) break;
    cut += character;
  }
  return cut;
}

function joinLines(lines: string[]): string {
  return lines.filter((line) => line !== '').join('\n');
}

export function remoteNotificationMessage(event: AttentionEvent, waitedMs: number): Required<NtfyMessage> {
  const { lead, detail } = leadAndDetail(event);
  const waitingLine = `Waiting for ${Math.floor(waitedMs / 60_000)} min`;
  let message = joinLines([lead, detail, waitingLine]);
  if (byteLength(message) > REMOTE_BODY_MAX_BYTES) {
    const frame = byteLength(joinLines([lead, '', SHORTENED_LINE, waitingLine])) + 1;
    message = joinLines([lead, cutToBytes(detail, REMOTE_BODY_MAX_BYTES - frame), SHORTENED_LINE, waitingLine]);
  }
  return { title: notificationTitle(event.folder, event.label), message, priority: REMOTE_PRIORITY_HIGH };
}
