import { plainExcerpt } from '../sessions/plain-excerpt.js';
import { type RunningTool, runningToolOf } from '../sessions/running-tool.js';
import type { SessionState } from '../sessions/session-state-tracker.js';
import type { SubagentState } from './subagent-state.js';
import type { SubagentView, TurnModel, TurnStep } from './turn-model.js';

export type TurnStatus = 'none' | 'running' | 'ended';

export interface SubagentGroup {
  step: number;
  subagents: string[];
}

export interface TurnSubagent {
  id: string;
  type?: string;
  description?: string;
  model?: string;
  state: SubagentState;
  startedAt?: string;
  endedAt?: string;
  latestText?: string;
  currentTool?: RunningTool;
  groups: SubagentGroup[];
}

export interface TurnTree {
  number: number;
  status: TurnStatus;
  steps: TurnStep[];
  groups: SubagentGroup[];
  earlier: string[];
  subagents: TurnSubagent[];
}

export interface IndexedStep {
  index: number;
  step: TurnStep;
}

export interface TurnUpdate {
  type: 'update';
  status?: TurnStatus;
  steps?: IndexedStep[];
  groups?: SubagentGroup[];
  earlier?: string[];
  subagents?: TurnSubagent[];
}

export type TurnChange = { type: 'turn'; turn: TurnTree } | TurnUpdate;

const LATEST_TEXT_LENGTH = 400;

export const noTurn = (): TurnTree => ({ number: 0, status: 'none', steps: [], groups: [], earlier: [], subagents: [] });

const nonEmpty = (value: string | undefined) => (value ? value : undefined);

function append<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function groupsOf(children: readonly SubagentView[]): SubagentGroup[] {
  const stepOf = (view: SubagentView) => view.startedBy?.step ?? 0;
  const groups: SubagentGroup[] = [];
  for (const view of [...children].sort((a, b) => stepOf(a) - stepOf(b))) {
    const last = groups.at(-1);
    if (last && stepOf(view) - last.step <= 1) {
      last.step = stepOf(view);
      last.subagents.push(view.id);
    } else {
      groups.push({ step: stepOf(view), subagents: [view.id] });
    }
  }
  return groups;
}

function subagentOf(view: SubagentView, groups: SubagentGroup[]): TurnSubagent {
  const type = nonEmpty(view.meta.agentType);
  const description = nonEmpty(view.meta.description);
  const model = nonEmpty(view.meta.model) ?? nonEmpty(view.responseModel);
  const latestText = view.lastText && nonEmpty(plainExcerpt(view.lastText.text, LATEST_TEXT_LENGTH));
  const running = view.state === 'running';
  const currentTool = running ? runningToolOf(view.openCalls) : undefined;
  return {
    id: view.id,
    ...(type && { type }),
    ...(description && { description }),
    ...(model && { model }),
    state: view.state,
    ...(view.startedAt !== undefined && { startedAt: view.startedAt }),
    ...(!running && view.lastLineAt !== undefined && { endedAt: view.lastLineAt }),
    ...(latestText && { latestText }),
    ...(currentTool && { currentTool }),
    groups,
  };
}

export function turnTreeOf(model: Pick<TurnModel, 'turnNumber' | 'steps' | 'subagents'>, state: SessionState): TurnTree {
  const number = model.turnNumber();
  if (number === 0) return noTurn();
  const views = model.subagents(state === 'ended');
  const mainChildren: SubagentView[] = [];
  const children = new Map<string, SubagentView[]>();
  for (const view of views) {
    if (!view.startedBy) continue;
    if (view.startedBy.parent === undefined) mainChildren.push(view);
    else append(children, view.startedBy.parent, view);
  }
  const shown = new Set<string>();
  const placed = new Map<string, SubagentView[]>();
  const show = (roots: readonly SubagentView[]) => {
    const queue = roots.filter((root) => !shown.has(root.id));
    for (const root of queue) shown.add(root.id);
    for (let index = 0; index < queue.length; index += 1) {
      const parent = queue[index]!;
      for (const child of children.get(parent.id) ?? []) {
        if (shown.has(child.id)) continue;
        shown.add(child.id);
        append(placed, parent.id, child);
        queue.push(child);
      }
    }
  };
  show(mainChildren);
  const earlier: string[] = [];
  for (;;) {
    const candidates = views.filter((view) => view.state === 'running' && !shown.has(view.id));
    if (candidates.length === 0) break;
    const ids = new Set(candidates.map((view) => view.id));
    const roots = candidates.filter((view) => view.startedBy?.parent === undefined || !ids.has(view.startedBy.parent));
    const next = roots.length > 0 ? roots : candidates.slice(0, 1);
    earlier.push(...next.map((view) => view.id));
    show(next);
  }
  return {
    number,
    status: state === 'working' || state === 'needs_input' ? 'running' : 'ended',
    steps: model.steps(),
    groups: groupsOf(mainChildren),
    earlier,
    subagents: views.filter((view) => shown.has(view.id)).map((view) => subagentOf(view, groupsOf(placed.get(view.id) ?? []))),
  };
}

export function turnChangeOf(previous: TurnTree | undefined, next: TurnTree): TurnChange | undefined {
  if (!previous || previous.number !== next.number || next.steps.length < previous.steps.length) return { type: 'turn', turn: next };
  const steps = next.steps.flatMap((step, index) => (step === previous.steps[index] ? [] : [{ index, step }]));
  const before = new Map(previous.subagents.map((subagent) => [subagent.id, subagent]));
  const subagents = next.subagents.filter((subagent) => !sameJson(subagent, before.get(subagent.id)));
  const update: TurnUpdate = {
    type: 'update',
    ...(previous.status !== next.status && { status: next.status }),
    ...(steps.length > 0 && { steps }),
    ...(!sameJson(previous.groups, next.groups) && { groups: next.groups }),
    ...(!sameJson(previous.earlier, next.earlier) && { earlier: next.earlier }),
    ...(subagents.length > 0 && { subagents }),
  };
  return Object.keys(update).length > 1 ? update : undefined;
}
