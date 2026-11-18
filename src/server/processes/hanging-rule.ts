import type { ProcessKind } from './process-kind.js';
import type { ProcessFacts } from './process-reader.js';

const isServerKind = (kind: ProcessKind | undefined) => kind === 'app-server' || kind === 'test-server';

export function isHanging(fact: ProcessFacts, kinds: Map<number, ProcessKind>, facts: ProcessFacts[], ownPid: number): boolean {
  if (fact.pid === ownPid) return false;
  const kind = kinds.get(fact.pid);
  if (kind === 'fake-claude' || kind === 'claude-session') return !isServerKind(kinds.get(fact.ppid));
  if (!isServerKind(kind)) return false;
  const launcher = fact.markers.launcher;
  if (!launcher) return false;
  return !facts.some((other) => other.pid === launcher.pid && other.startTicks === launcher.startTicks);
}
