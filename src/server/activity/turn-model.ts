import { type ConversationItem, itemsOf, type SubagentMeta } from '../external/transcript-reader.js';
import { stoppedTaskIdOf, type SubagentState, subagentStateOf } from './subagent-state.js';
import { isInterruptMarker, startsTurn } from './turn-rule.js';

type Entry = Record<string, unknown>;

export interface TimedText {
  text: string;
  at?: string;
  order: number;
}

export interface OpenCall {
  id: string;
  name: string;
  input?: unknown;
  subagentType?: string;
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
  openCalls: Map<string, OpenCall>;
}

interface TimedEvent {
  at: string;
  time: number;
}

const AGENT_FILE_PREFIX = 'agent-';

function timeOf(entry: Entry): TimedEvent | undefined {
  const at = entry.timestamp;
  const time = typeof at === 'string' ? Date.parse(at) : Number.NaN;
  return typeof at === 'string' && !Number.isNaN(time) ? { at, time } : undefined;
}

const timeOfAt = ({ at }: { at?: string }) => (at === undefined ? undefined : Date.parse(at));

const copyOf = (text: TimedText | undefined) => text && { ...text };

function byStart(a: OpenCall, b: OpenCall): number {
  const timeA = timeOfAt(a);
  const timeB = timeOfAt(b);
  return timeA === undefined || timeB === undefined || timeA === timeB ? a.order - b.order : timeA - timeB;
}

function nowEvent(): TimedEvent {
  const time = Date.now();
  return { at: new Date(time).toISOString(), time };
}

function toolInputOf(entry: Entry, id: string): unknown {
  const content = (entry.message as { content?: unknown } | undefined)?.content;
  const blocks: unknown[] = Array.isArray(content) ? content : [];
  const isCall = (part: unknown): part is Entry =>
    typeof part === 'object' && part !== null && (part as Entry).type === 'tool_use' && (part as Entry).id === id;
  return blocks.find(isCall)?.input;
}

export class TurnModel {
  #turnStart: number | undefined;
  #mainText: TimedText | undefined;
  readonly #subagents = new Map<string, Subagent>();
  readonly #stopNotices = new Map<string, number | undefined>();
  readonly #mainCalls = new Map<string, OpenCall>();
  #lastEvent: TimedEvent | undefined;
  #order = 0;

  addMainEntries(entries: readonly Entry[]): void {
    for (const entry of entries) {
      this.#noteActivity(entry);
      if (startsTurn(entry)) this.#startTurn(timeOf(entry)?.time);
      const stoppedTaskId = stoppedTaskIdOf(entry);
      if (stoppedTaskId !== undefined) this.#stopNotices.set(`${AGENT_FILE_PREFIX}${stoppedTaskId}`, timeOf(entry)?.time);
      for (const item of itemsOf(entry)) {
        this.#followCalls(this.#mainCalls, item, entry);
        if (item.kind === 'assistant') this.#mainText = this.#textOf(item.text, entry);
      }
    }
  }

  addSubagentEntries(id: string, entries: readonly Entry[]): void {
    const subagent = this.#subagentOf(id);
    for (const entry of entries) {
      this.#noteActivity(entry);
      const time = timeOf(entry)?.time;
      if (entry.type === 'assistant') {
        subagent.interruptedInFile = false;
        if (time !== undefined) subagent.lastAssistantTime = Math.max(time, subagent.lastAssistantTime ?? time);
      }
      for (const item of itemsOf(entry, undefined, { sidechain: true })) {
        this.#followCalls(subagent.openCalls, item, entry);
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
      state: this.#stateOf(id, subagent, sessionEnded),
      ...(subagent.latestText && { latestText: copyOf(subagent.latestText) }),
    }));
  }

  lastEventAt(): string | undefined {
    return this.#lastEvent?.at;
  }

  openCalls(sessionEnded: boolean): OpenCall[] {
    const calls = [...this.#mainCalls.values()].map((call) => ({ ...call }));
    for (const [id, subagent] of this.#subagents) {
      if (this.#stateOf(id, subagent, sessionEnded) !== 'running') continue;
      const subagentType = subagent.meta.agentType;
      for (const call of subagent.openCalls.values()) calls.push({ ...call, ...(subagentType && { subagentType }) });
    }
    return calls.sort(byStart);
  }

  #stateOf(id: string, subagent: Subagent, sessionEnded: boolean): SubagentState {
    return subagentStateOf({ finished: subagent.meta.finished, interrupted: this.#interrupted(id, subagent), sessionEnded });
  }

  #noteActivity(entry: Entry): void {
    if (entry.type !== 'user' && entry.type !== 'assistant') return;
    const event = timeOf(entry) ?? nowEvent();
    if (!this.#lastEvent || event.time > this.#lastEvent.time) this.#lastEvent = event;
  }

  #followCalls(calls: Map<string, OpenCall>, item: ConversationItem, entry: Entry): void {
    if (item.kind === 'user') calls.clear();
    else if (item.kind === 'tool_result' && item.toolUseId !== undefined) calls.delete(item.toolUseId);
    else if (item.kind === 'tool_call' && item.id !== undefined) calls.set(item.id, this.#callOf(item.id, item.name, entry));
  }

  #startTurn(time: number | undefined): void {
    this.#turnStart = time;
    this.#mainText = undefined;
    for (const subagent of this.#subagents.values()) {
      const textTime = subagent.latestText && timeOfAt(subagent.latestText);
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
      subagent = { meta: {}, interruptedInFile: false, openCalls: new Map() };
      this.#subagents.set(id, subagent);
    }
    return subagent;
  }

  #textOf(text: string, entry: Entry): TimedText {
    this.#order += 1;
    const at = timeOf(entry)?.at;
    return { text, ...(at !== undefined && { at }), order: this.#order };
  }

  #callOf(id: string, name: string, entry: Entry): OpenCall {
    this.#order += 1;
    const at = timeOf(entry)?.at;
    const input = toolInputOf(entry, id);
    return { id, name, ...(input !== undefined && { input }), ...(at !== undefined && { at }), order: this.#order };
  }
}
