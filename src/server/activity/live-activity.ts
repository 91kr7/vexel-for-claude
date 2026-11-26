import { plainExcerpt } from '../sessions/plain-excerpt.js';
import type { SessionState } from '../sessions/session-state-tracker.js';
import type { TimedText, TurnModel } from './turn-model.js';

export interface LatestText {
  text: string;
  subagentType?: string;
  at?: string;
}

export interface LiveActivity {
  atWork: boolean;
  latestText?: LatestText;
}

interface Candidate {
  text: TimedText;
  subagentType?: string;
}

const LATEST_TEXT_LENGTH = 400;

function isLater(a: TimedText, b: TimedText): boolean {
  const timeA = a.at === undefined ? Number.NaN : Date.parse(a.at);
  const timeB = b.at === undefined ? Number.NaN : Date.parse(b.at);
  if (Number.isNaN(timeA) || Number.isNaN(timeB) || timeA === timeB) return a.order > b.order;
  return timeA > timeB;
}

export function liveActivityOf(model: Pick<TurnModel, 'mainText' | 'subagents'>, state: SessionState): LiveActivity {
  const ended = state === 'ended';
  const running = model.subagents(ended).filter((subagent) => subagent.state === 'running');
  const atWork = state === 'working' || (!ended && running.length > 0);
  if (!atWork) return { atWork };
  const main = model.mainText();
  let latest: Candidate | undefined = main && { text: main };
  for (const subagent of running) {
    if (subagent.latestText && (!latest || isLater(subagent.latestText, latest.text))) {
      latest = { text: subagent.latestText, subagentType: subagent.meta.agentType };
    }
  }
  const text = latest && plainExcerpt(latest.text.text, LATEST_TEXT_LENGTH);
  if (!latest || !text) return { atWork };
  const { subagentType } = latest;
  const { at } = latest.text;
  return { atWork, latestText: { text, ...(subagentType && { subagentType }), ...(at !== undefined && { at }) } };
}
