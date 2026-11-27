import { plainExcerpt } from '../sessions/plain-excerpt.js';
import { type RunningTool, runningToolOf } from '../sessions/running-tool.js';
import type { SessionState } from '../sessions/session-state-tracker.js';
import type { SubagentState } from './subagent-state.js';
import type { SubagentView, TurnModel } from './turn-model.js';

export interface SubagentGroup {
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
  groups: SubagentGroup[];
  subagents: TurnSubagent[];
}

export interface TurnUpdate {
  type: 'update';
  groups?: SubagentGroup[];
  subagents?: TurnSubagent[];
}

export type TurnChange = { type: 'turn'; turn: TurnTree } | TurnUpdate;

const LATEST_TEXT_LENGTH = 400;

export const noTurn = (): TurnTree => ({ number: 0, groups: [], subagents: [] });

const nonEmpty = (value: string | undefined) => (value ? value : undefined);

function append<K, T>(map: Map<K, T[]>, key: K, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const startOf = (view: SubagentView) => (view.startedAt === undefined ? Number.POSITIVE_INFINITY : Date.parse(view.startedAt));

const byTime = (a: number, b: number) => (a === b ? 0 : a - b);

const byStart = (a: SubagentView, b: SubagentView) => byTime(startOf(a), startOf(b));

const stepOf = (view: SubagentView) => view.startedBy?.step ?? 0;

function joinsGroup(view: SubagentView, last: SubagentView): boolean {
  const message = view.startedBy?.message;
  const lastMessage = last.startedBy?.message;
  if (message !== undefined && lastMessage !== undefined) return message === lastMessage;
  return stepOf(view) - stepOf(last) <= 1;
}

function linkedGroupsOf(siblings: readonly SubagentView[]): SubagentView[][] {
  const groups: SubagentView[][] = [];
  for (const view of [...siblings].sort((a, b) => stepOf(a) - stepOf(b))) {
    const last = groups.at(-1);
    if (last && joinsGroup(view, last.at(-1)!)) last.push(view);
    else groups.push([view]);
  }
  return groups;
}

function groupsOf(views: readonly SubagentView[], sortStartOf: (view: SubagentView) => number): SubagentGroup[] {
  const groups: SubagentView[][] = [];
  const siblingsOf = new Map<string | undefined, SubagentView[]>();
  const groupOfMessage = new Map<string, SubagentView[]>();
  for (const view of views) {
    if (view.startedBy) {
      append(siblingsOf, view.startedBy.parent, view);
      continue;
    }
    const message = view.earlierMessage;
    const group = message === undefined ? undefined : groupOfMessage.get(message);
    if (group) group.push(view);
    else {
      const created = [view];
      groups.push(created);
      if (message !== undefined) groupOfMessage.set(message, created);
    }
  }
  for (const siblings of siblingsOf.values()) groups.push(...linkedGroupsOf(siblings));
  return groups
    .map((members) => members.sort(byStart))
    .sort((a, b) => byTime(sortStartOf(a[0]!), sortStartOf(b[0]!)) || byStart(a[0]!, b[0]!))
    .map((members) => ({ subagents: members.map((view) => view.id) }));
}

// Walks up the ended ancestors: the nearest running one is the parent shown, the highest ended one gives the place.
function placeOf(view: SubagentView, views: ReadonlyMap<string, SubagentView>): { parent?: string; anchor: SubagentView } {
  const seen = new Set([view.id]);
  let anchor = view;
  for (let id = view.startedBy?.parent; id !== undefined && !seen.has(id); id = anchor.startedBy?.parent) {
    seen.add(id);
    const ancestor = views.get(id);
    if (!ancestor) break;
    if (ancestor.state === 'running') return { parent: id, anchor };
    anchor = ancestor;
  }
  return { anchor };
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

export function turnTreeOf(model: Pick<TurnModel, 'turnNumber' | 'subagents'>, state: SessionState): TurnTree {
  const number = model.turnNumber();
  if (number === 0) return noTurn();
  const views = model.subagents(state === 'ended');
  const byId = new Map(views.map((view) => [view.id, view]));
  const running = views.filter((view) => view.state === 'running');
  const sortStarts = new Map<string, number>();
  const roots: SubagentView[] = [];
  const children = new Map<string, SubagentView[]>();
  for (const view of running) {
    const { parent, anchor } = placeOf(view, byId);
    sortStarts.set(view.id, startOf(anchor));
    if (parent === undefined) roots.push(view);
    else append(children, parent, view);
  }
  const sortStartOf = (view: SubagentView) => sortStarts.get(view.id) ?? startOf(view);
  const shown = new Set<string>();
  const placed = new Map<string, SubagentView[]>();
  const show = (root: SubagentView) => {
    const queue = [root];
    shown.add(root.id);
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
  for (const root of roots) show(root);
  for (let loop = running.find((view) => !shown.has(view.id)); loop; loop = running.find((view) => !shown.has(view.id))) {
    roots.push(loop);
    show(loop);
  }
  return {
    number,
    groups: groupsOf(roots, sortStartOf),
    subagents: running.map((view) => subagentOf(view, groupsOf(placed.get(view.id) ?? [], sortStartOf))),
  };
}

export function turnChangeOf(previous: TurnTree | undefined, next: TurnTree): TurnChange | undefined {
  if (!previous || previous.number !== next.number) return { type: 'turn', turn: next };
  const before = new Map(previous.subagents.map((subagent) => [subagent.id, subagent]));
  const subagents = next.subagents.filter((subagent) => !sameJson(subagent, before.get(subagent.id)));
  const update: TurnUpdate = {
    type: 'update',
    ...(!sameJson(previous.groups, next.groups) && { groups: next.groups }),
    ...(subagents.length > 0 && { subagents }),
  };
  return Object.keys(update).length > 1 ? update : undefined;
}
