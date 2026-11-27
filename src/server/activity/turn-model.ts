import { type ConversationItem, itemsOf, type SubagentMeta } from '../external/transcript-reader.js';
import { plainExcerpt } from '../sessions/plain-excerpt.js';
import { runningToolOf } from '../sessions/running-tool.js';
import { stoppedTaskIdOf, type SubagentState, subagentStateOf } from './subagent-state.js';
import { isInterruptMarker, startsTurn } from './turn-rule.js';
import { notifiedTaskIdOf, taskStopSucceeded, workflowLaunchOf, workflowSubagentStateOf } from './workflow-state.js';

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

export type ToolOutcome = 'running' | 'completed' | 'error';

export type TurnStep =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'tool'; readonly name?: string; readonly argument?: string; readonly outcome?: ToolOutcome };

export interface StepLink {
  parent?: string;
  step: number;
  message?: string;
}

export interface SubagentView {
  id: string;
  meta: SubagentMeta;
  state: SubagentState;
  latestText?: TimedText;
  lastText?: TimedText;
  startedAt?: string;
  lastLineAt?: string;
  responseModel?: string;
  openCalls: OpenCall[];
  startedBy?: StepLink;
}

interface Subagent {
  meta: SubagentMeta;
  latestText?: TimedText;
  lastText?: TimedText;
  interruptedInFile: boolean;
  lastAssistantTime?: number;
  openCalls: Map<string, OpenCall>;
  firstLine?: TimedEvent;
  lastLine?: TimedEvent;
  responseModel?: string;
  stepCount: number;
  startedBy?: StepLink;
  runId?: string;
  workflowResult: boolean;
}

interface WorkflowCall {
  time?: number;
  position?: StepLink;
}

interface WorkflowLaunch extends WorkflowCall {
  callId: string;
  runId: string;
  taskId?: string;
  over: boolean;
}

interface TimedEvent {
  at: string;
  time: number;
}

const AGENT_FILE_PREFIX = 'agent-';
const STEP_TEXT_LENGTH = 400;
const REMEMBERED_SUBAGENT_CALLS = 2000;
const SYNTHETIC_MODEL = '<synthetic>';
const WORKFLOW_TOOL = 'Workflow';
const TASK_STOP_TOOL = 'TaskStop';
const JOURNAL_STARTED = 'started';
const JOURNAL_RESULT = 'result';

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

function cut(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const characters = Array.from(text.slice(0, 2 * maxLength + 2));
  return characters.length > maxLength ? `${characters.slice(0, maxLength - 1).join('')}…` : text;
}

function toolInputsOf(entry: Entry): unknown[] {
  const content = (entry.message as { content?: unknown } | undefined)?.content;
  const blocks: unknown[] = Array.isArray(content) ? content : [];
  const isToolUse = (part: unknown): part is Entry => typeof part === 'object' && part !== null && (part as Entry).type === 'tool_use';
  return blocks.filter(isToolUse).map((block) => block.input);
}

function toolStepOf(name: string, id: string | undefined, input: unknown): TurnStep {
  const argument = runningToolOf([{ name, input }])?.argument;
  return {
    kind: 'tool',
    ...(name && { name }),
    ...(argument && { argument: cut(argument, STEP_TEXT_LENGTH) }),
    ...(id !== undefined && { outcome: 'running' as const }),
  };
}

function messageIdOf(entry: Entry): string | undefined {
  const id = (entry.message as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

const linkOf = (step: number, message: string | undefined, parent?: string): StepLink => ({
  ...(parent !== undefined && { parent }),
  step,
  ...(message !== undefined && { message }),
});

function responseModelOf(entry: Entry): string | undefined {
  const model = (entry.message as { model?: unknown } | null | undefined)?.model;
  return typeof model === 'string' && model !== '' && model !== SYNTHETIC_MODEL ? model : undefined;
}

const withType = (call: OpenCall, subagentType: string | undefined): OpenCall => ({ ...call, ...(subagentType && { subagentType }) });

export class TurnModel {
  #turnStart: number | undefined;
  #turnNumber = 0;
  #mainText: TimedText | undefined;
  #steps: TurnStep[] = [];
  readonly #mainCallSteps = new Map<string, StepLink>();
  readonly #subagentCallSteps = new Map<string, StepLink>();
  readonly #subagentOfStart = new Map<string, string>();
  readonly #subagents = new Map<string, Subagent>();
  readonly #stopNotices = new Map<string, number | undefined>();
  readonly #mainCalls = new Map<string, OpenCall>();
  readonly #workflowCalls = new Map<string, WorkflowCall>();
  readonly #taskStops = new Map<string, string>();
  readonly #launches: WorkflowLaunch[] = [];
  #lastEvent: TimedEvent | undefined;
  #order = 0;

  addMainEntries(entries: readonly Entry[]): void {
    for (const entry of entries) {
      this.#noteActivity(entry);
      if (startsTurn(entry)) this.#startTurn(timeOf(entry)?.time);
      const stoppedTaskId = stoppedTaskIdOf(entry);
      if (stoppedTaskId !== undefined) this.#stopNotices.set(`${AGENT_FILE_PREFIX}${stoppedTaskId}`, timeOf(entry)?.time);
      const inputs = toolInputsOf(entry);
      const message = messageIdOf(entry);
      let calls = 0;
      for (const item of itemsOf(entry)) {
        this.#followCalls(this.#mainCalls, item, entry);
        this.#followWorkflows(item, entry);
        this.#followSteps(item, item.kind === 'tool_call' ? inputs[calls++] : undefined, message);
        if (item.kind === 'assistant') this.#mainText = this.#textOf(item.text, entry);
      }
    }
  }

  addSubagentEntries(id: string, entries: readonly Entry[], runId?: string): void {
    const subagent = this.#subagentOf(id);
    if (runId !== undefined) subagent.runId = runId;
    for (const entry of entries) {
      this.#noteActivity(entry);
      const line = timeOf(entry);
      const time = line?.time;
      if (line) {
        subagent.firstLine ??= line;
        if (!subagent.lastLine || line.time > subagent.lastLine.time) subagent.lastLine = line;
      }
      if (entry.type === 'assistant') {
        subagent.interruptedInFile = false;
        if (time !== undefined) subagent.lastAssistantTime = Math.max(time, subagent.lastAssistantTime ?? time);
        subagent.responseModel = responseModelOf(entry) ?? subagent.responseModel;
      }
      const message = messageIdOf(entry);
      for (const item of itemsOf(entry, undefined, { sidechain: true })) {
        this.#followCalls(subagent.openCalls, item, entry);
        this.#followWorkflows(item, entry, linkOf(subagent.stepCount, message, id));
        if (item.kind === 'tool_call' || item.kind === 'assistant') this.#countStep(id, subagent, item, message);
        if (item.kind === 'user' && isInterruptMarker(item.text)) subagent.interruptedInFile = true;
        else if (item.kind === 'assistant') {
          const text = this.#textOf(item.text, entry);
          subagent.lastText = text;
          if (!this.#beforeTurn(time)) subagent.latestText = text;
        }
      }
    }
  }

  addWorkflowEntries(runId: string, entries: readonly Entry[]): void {
    for (const entry of entries) {
      const { type, agentId } = entry;
      if ((type !== JOURNAL_STARTED && type !== JOURNAL_RESULT) || typeof agentId !== 'string' || !agentId) continue;
      const subagent = this.#subagentOf(`${AGENT_FILE_PREFIX}${agentId}`);
      subagent.runId = runId;
      if (type === JOURNAL_RESULT) subagent.workflowResult = true;
    }
  }

  setSubagentMeta(id: string, meta: SubagentMeta): void {
    const subagent = this.#subagentOf(id);
    subagent.meta = { ...meta };
    const start = meta.toolUseId;
    if (!start) return;
    this.#subagentOfStart.set(start, id);
    const link = this.#subagentCallSteps.get(start);
    if (link === undefined) return;
    subagent.startedBy ??= link;
    this.#subagentCallSteps.delete(start);
  }

  turnNumber(): number {
    return this.#turnNumber;
  }

  steps(): TurnStep[] {
    return [...this.#steps];
  }

  mainText(): TimedText | undefined {
    return copyOf(this.#mainText);
  }

  subagents(sessionEnded: boolean): SubagentView[] {
    return [...this.#subagents].map(([id, subagent]) => {
      const state = this.#stateOf(id, subagent, sessionEnded);
      const startedBy = this.#startOf(subagent);
      const { agentType } = subagent.meta;
      const openCalls = state === 'running' ? [...subagent.openCalls.values()].map((call) => withType(call, agentType)).sort(byStart) : [];
      return {
        id,
        meta: { ...subagent.meta },
        state,
        ...(subagent.latestText && { latestText: copyOf(subagent.latestText) }),
        ...(subagent.lastText && { lastText: copyOf(subagent.lastText) }),
        ...(subagent.firstLine && { startedAt: subagent.firstLine.at }),
        ...(subagent.lastLine && { lastLineAt: subagent.lastLine.at }),
        ...(subagent.responseModel !== undefined && { responseModel: subagent.responseModel }),
        openCalls,
        ...(startedBy && { startedBy: { ...startedBy } }),
      };
    });
  }

  lastEventAt(): string | undefined {
    return this.#lastEvent?.at;
  }

  openCalls(sessionEnded: boolean): OpenCall[] {
    const calls = [...this.#mainCalls.values()].map((call) => ({ ...call }));
    for (const [id, subagent] of this.#subagents) {
      if (this.#stateOf(id, subagent, sessionEnded) !== 'running') continue;
      for (const call of subagent.openCalls.values()) calls.push(withType(call, subagent.meta.agentType));
    }
    return calls.sort(byStart);
  }

  #stateOf(id: string, subagent: Subagent, sessionEnded: boolean): SubagentState {
    if (subagent.runId !== undefined) {
      const { launch, latest } = this.#launchOf(subagent, subagent.runId);
      return workflowSubagentStateOf({
        result: subagent.workflowResult,
        launchOver: launch?.over === true,
        startedBeforeLatestLaunch: launch !== latest,
        sessionEnded,
      });
    }
    return subagentStateOf({ finished: subagent.meta.finished, interrupted: this.#interrupted(id, subagent), sessionEnded });
  }

  #launchOf(subagent: Subagent, runId: string): { launch?: WorkflowLaunch; latest?: WorkflowLaunch } {
    const launches = this.#launches.filter((launch) => launch.runId === runId);
    const first = subagent.firstLine?.time;
    const launch = launches.findLast(({ time }) => first === undefined || time === undefined || time <= first);
    return { launch, latest: launches.at(-1) };
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

  #followWorkflows(item: ConversationItem, entry: Entry, position?: StepLink): void {
    if (item.kind === 'user') {
      const taskId = notifiedTaskIdOf(item.text);
      if (taskId !== undefined) this.#endLaunches(taskId);
    } else if (item.kind === 'tool_call' && item.id !== undefined) {
      if (item.name === WORKFLOW_TOOL) {
        const time = timeOf(entry)?.time;
        this.#workflowCalls.set(item.id, { ...(time !== undefined && { time }), ...(position && { position }) });
      } else if (item.name === TASK_STOP_TOOL) {
        const taskId = (toolInputOf(entry, item.id) as { task_id?: unknown } | null | undefined)?.task_id;
        if (typeof taskId === 'string' && taskId) this.#taskStops.set(item.id, taskId);
      }
    } else if (item.kind === 'tool_result' && item.toolUseId !== undefined) {
      const call = this.#workflowCalls.get(item.toolUseId);
      const stoppedTask = this.#taskStops.get(item.toolUseId);
      this.#workflowCalls.delete(item.toolUseId);
      this.#taskStops.delete(item.toolUseId);
      const launch = call && workflowLaunchOf(entry, item.toolUseId);
      if (launch) this.#launches.push({ ...call, callId: item.toolUseId, ...launch, over: false });
      if (stoppedTask !== undefined && taskStopSucceeded(entry, item.toolUseId)) this.#endLaunches(stoppedTask);
    }
  }

  #endLaunches(taskId: string): void {
    for (const launch of this.#launches) if (launch.taskId === taskId) launch.over = true;
  }

  #followSteps(item: ConversationItem, input: unknown, message: string | undefined): void {
    if (item.kind === 'assistant') {
      const text = plainExcerpt(item.text, STEP_TEXT_LENGTH);
      if (text) this.#steps.push({ kind: 'text', text });
    } else if (item.kind === 'tool_call') {
      if (item.id !== undefined) this.#mainCallSteps.set(item.id, linkOf(this.#steps.length, message));
      this.#steps.push(toolStepOf(item.name, item.id, input));
    } else if (item.kind === 'tool_result' && item.toolUseId !== undefined) {
      const index = this.#mainCallSteps.get(item.toolUseId)?.step;
      const step = index === undefined ? undefined : this.#steps[index];
      const outcome = item.isError ? 'error' : 'completed';
      if (index !== undefined && step?.kind === 'tool' && step.outcome !== outcome) this.#steps[index] = { ...step, outcome };
    }
  }

  #countStep(id: string, subagent: Subagent, item: ConversationItem, message: string | undefined): void {
    const link = linkOf(subagent.stepCount, message, id);
    subagent.stepCount += 1;
    if (item.kind !== 'tool_call' || item.id === undefined) return;
    const childId = this.#subagentOfStart.get(item.id);
    const child = childId === undefined ? undefined : this.#subagents.get(childId);
    if (child) {
      child.startedBy ??= link;
      return;
    }
    this.#subagentCallSteps.set(item.id, link);
    if (this.#subagentCallSteps.size > REMEMBERED_SUBAGENT_CALLS) {
      const oldest = this.#subagentCallSteps.keys().next().value;
      if (oldest !== undefined) this.#subagentCallSteps.delete(oldest);
    }
  }

  #startOf(subagent: Subagent): StepLink | undefined {
    if (subagent.runId !== undefined) {
      const { launch } = this.#launchOf(subagent, subagent.runId);
      if (launch?.position) return launch.position;
      return launch && this.#mainCallSteps.get(launch.callId);
    }
    const start = subagent.meta.toolUseId;
    return (start ? this.#mainCallSteps.get(start) : undefined) ?? subagent.startedBy;
  }

  #startTurn(time: number | undefined): void {
    this.#turnStart = time;
    this.#turnNumber += 1;
    this.#mainText = undefined;
    this.#steps = [];
    this.#mainCallSteps.clear();
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
      subagent = { meta: {}, interruptedInFile: false, openCalls: new Map(), stepCount: 0, workflowResult: false };
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
