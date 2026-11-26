import { itemsOf, type SubagentMeta } from '../external/transcript-reader.js';
import { stoppedTaskIdOf, type SubagentState, subagentStateOf } from './subagent-state.js';
import { isInterruptMarker, startsTurn } from './turn-rule.js';

type Entry = Record<string, unknown>;

export interface TimedText {
  text: string;
  at?: string;
  order: number;
}

export interface SubagentView {
  id: string;
  meta: SubagentMeta;
  state: SubagentState;
  latestText?: TimedText;
}

interface Subagent {
  meta: SubagentMeta;
  latestText?: TimedText;
  interruptedInFile: boolean;
  lastAssistantTime?: number;
}

const AGENT_FILE_PREFIX = 'agent-';

function timeOf(entry: Entry): { at: string; time: number } | undefined {
  const at = entry.timestamp;
  const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  return typeof at === 'string' && !Number.isNaN(time) ? { at, time } : undefined;
}

const timeOfText = (text: TimedText) => (text.at === undefined ? undefined : Date.parse(text.at));

const copyOf = (text: TimedText | undefined) => text && { ...text };

export class TurnModel {
  #turnStart: number | undefined;
  #mainText: TimedText | undefined;
  readonly #subagents = new Map<string, Subagent>();
  readonly #stopNotices = new Map<string, number | undefined>();
  #order = 0;

  addMainEntries(entries: readonly Entry[]): void {
    for (const entry of entries) {
      if (startsTurn(entry)) this.#startTurn(timeOf(entry)?.time);
      const stoppedTaskId = stoppedTaskIdOf(entry);
      if (stoppedTaskId !== undefined) this.#stopNotices.set(`${AGENT_FILE_PREFIX}${stoppedTaskId}`, timeOf(entry)?.time);
      for (const item of itemsOf(entry)) {
        if (item.kind === 'assistant') this.#mainText = this.#textOf(item.text, entry);
      }
    }
  }

  addSubagentEntries(id: string, entries: readonly Entry[]): void {
    const subagent = this.#subagentOf(id);
    for (const entry of entries) {
      const time = timeOf(entry)?.time;
      if (entry.type === 'assistant') {
        subagent.interruptedInFile = false;
        if (time !== undefined) subagent.lastAssistantTime = Math.max(time, subagent.lastAssistantTime ?? time);
      }
      for (const item of itemsOf(entry, undefined, { sidechain: true })) {
        if (item.kind === 'user' && isInterruptMarker(item.text)) subagent.interruptedInFile = true;
        else if (item.kind === 'assistant' && !this.#beforeTurn(time)) subagent.latestText = this.#textOf(item.text, entry);
      }
    }
  }

  setSubagentMeta(id: string, meta: SubagentMeta): void {
    this.#subagentOf(id).meta = { ...meta };
  }

  mainText(): TimedText | undefined {
    return copyOf(this.#mainText);
  }

  subagents(sessionEnded: boolean): SubagentView[] {
    return [...this.#subagents].map(([id, subagent]) => ({
      id,
      meta: { ...subagent.meta },
      state: subagentStateOf({ finished: subagent.meta.finished, interrupted: this.#interrupted(id, subagent), sessionEnded }),
      ...(subagent.latestText && { latestText: copyOf(subagent.latestText) }),
    }));
  }

  #startTurn(time: number | undefined): void {
    this.#turnStart = time;
    this.#mainText = undefined;
    for (const subagent of this.#subagents.values()) {
      const textTime = subagent.latestText && timeOfText(subagent.latestText);
      if (time === undefined || textTime === undefined || textTime <= time) subagent.latestText = undefined;
    }
  }

  #beforeTurn(time: number | undefined): boolean {
    return this.#turnStart !== undefined && time !== undefined && time <= this.#turnStart;
  }

  #interrupted(id: string, subagent: Subagent): boolean {
    if (subagent.interruptedInFile) return true;
    if (!this.#stopNotices.has(id)) return false;
    const noticeTime = this.#stopNotices.get(id);
    return noticeTime === undefined || subagent.lastAssistantTime === undefined || subagent.lastAssistantTime <= noticeTime;
  }

  #subagentOf(id: string): Subagent {
    let subagent = this.#subagents.get(id);
    if (!subagent) {
      subagent = { meta: {}, interruptedInFile: false };
      this.#subagents.set(id, subagent);
    }
    return subagent;
  }

  #textOf(text: string, entry: Entry): TimedText {
    this.#order += 1;
    const at = timeOf(entry)?.at;
    return { text, ...(at !== undefined && { at }), order: this.#order };
  }
}
