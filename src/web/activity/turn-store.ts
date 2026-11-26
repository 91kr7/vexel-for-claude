import { useEffect, useState } from 'react';
import type { RunningTool } from '../sessions/live-session-store';

export type TurnStatus = 'none' | 'running' | 'ended';

export type ToolOutcome = 'running' | 'completed' | 'error';

export type TurnStep = { kind: 'text'; text: string } | { kind: 'tool'; name?: string; argument?: string; outcome?: ToolOutcome };

export type SubagentState = 'running' | 'finished' | 'stopped';

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

interface TurnUpdate {
  type: 'update';
  status?: TurnStatus;
  steps?: { index: number; step: TurnStep }[];
  groups?: SubagentGroup[];
  earlier?: string[];
  subagents?: TurnSubagent[];
}

type TurnFrame = { type: 'turn'; turn: TurnTree } | TurnUpdate;

export type TurnState = { status: 'loading' } | { status: 'unavailable' } | { status: 'loaded'; turn: TurnTree };

const STREAM_NOT_FOUND = 4404;
const RETRY_DELAY_MS = 2000;

function turnUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/turn`;
}

function frameOf(data: string): TurnFrame | undefined {
  try {
    const frame = JSON.parse(data) as Partial<TurnFrame> | null;
    if (frame?.type === 'turn' && typeof frame.turn === 'object' && frame.turn !== null) return frame as TurnFrame;
    if (frame?.type === 'update') return frame as TurnFrame;
  } catch {
    return undefined;
  }
  return undefined;
}

function applyTurnUpdate(turn: TurnTree, update: TurnUpdate): TurnTree {
  const steps = update.steps ? [...turn.steps] : turn.steps;
  for (const { index, step } of update.steps ?? []) steps[index] = step;
  const changed = new Map((update.subagents ?? []).map((subagent) => [subagent.id, subagent]));
  const subagents = turn.subagents.map((subagent) => changed.get(subagent.id) ?? subagent);
  const known = new Set(turn.subagents.map((subagent) => subagent.id));
  for (const subagent of changed.values()) if (!known.has(subagent.id)) subagents.push(subagent);
  return {
    ...turn,
    status: update.status ?? turn.status,
    steps,
    groups: update.groups ?? turn.groups,
    earlier: update.earlier ?? turn.earlier,
    subagents,
  };
}

export function useTurn(sessionId: string): TurnState {
  const [state, setState] = useState<TurnState>({ status: 'loading' });

  useEffect(() => {
    const listeners = new AbortController();
    const { signal } = listeners;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let loaded = false;
    setState({ status: 'loading' });
    const connect = () => {
      socket = new WebSocket(turnUrl(sessionId));
      let firstFrame = true;
      socket.addEventListener(
        'message',
        (event: MessageEvent<string>) => {
          const frame = frameOf(event.data);
          if (!frame) return;
          if (frame.type === 'turn') {
            firstFrame = false;
            loaded = true;
            setState({ status: 'loaded', turn: frame.turn });
          } else if (!firstFrame) {
            setState((current) => (current.status === 'loaded' ? { status: 'loaded', turn: applyTurnUpdate(current.turn, frame) } : current));
          }
        },
        { signal },
      );
      socket.addEventListener(
        'close',
        (event: CloseEvent) => {
          if (!loaded) setState({ status: 'unavailable' });
          else if (event.code !== STREAM_NOT_FOUND) retry = setTimeout(connect, RETRY_DELAY_MS);
        },
        { signal },
      );
    };
    connect();
    return () => {
      listeners.abort();
      clearTimeout(retry);
      socket.close();
    };
  }, [sessionId]);

  return state;
}
