import path from 'node:path';
import type { ProcessFacts } from './process-reader.js';

export type ProcessKind = 'app-server' | 'test-server' | 'fake-claude' | 'claude-session';

export interface ClassifyOptions {
  appName: string;
  ownPid: number;
}

const FAKE_CLI = 'test-support/fake-claude.mjs';
const SERVER_ENTRY = 'src/server/main.ts';

const namesFakeCli = (value: string) => value === FAKE_CLI || value.endsWith(`/${FAKE_CLI}`);
const baseName = (argv: string[]) => path.basename(argv[0] ?? '');

function runsServer(fact: ProcessFacts, appName: string): boolean {
  return (
    ['node', 'nodejs'].includes(baseName(fact.argv)) &&
    fact.argv.slice(1).some((arg) => arg === SERVER_ENTRY || arg.endsWith(`/${SERVER_ENTRY}`)) &&
    fact.cwdPackageName === appName
  );
}

function isAppElectron(fact: ProcessFacts, appName: string): boolean {
  return baseName(fact.argv) === 'electron' && !fact.argv.some((arg) => arg.startsWith('--type=')) && fact.cwdPackageName === appName;
}

function hasTestEnvironment(fact: ProcessFacts): boolean {
  return fact.markers.testServer || (fact.markers.claudeCli !== undefined && namesFakeCli(fact.markers.claudeCli));
}

export function classifyProcesses(facts: ProcessFacts[], { appName, ownPid }: ClassifyOptions): Map<number, ProcessKind> {
  const byPid = new Map(facts.map((fact) => [fact.pid, fact]));
  const servers = facts.filter((fact) => runsServer(fact, appName));
  const launchersOfServers = new Set(servers.map((server) => server.ppid).filter((ppid) => servers.some((s) => s.pid === ppid)));
  const kinds = new Map<number, ProcessKind>();
  for (const fact of facts) {
    const serverKind: ProcessKind = hasTestEnvironment(fact) ? 'test-server' : 'app-server';
    if (fact.argv.some(namesFakeCli)) kinds.set(fact.pid, 'fake-claude');
    else if (fact.pid === ownPid) kinds.set(fact.pid, serverKind);
    else if (runsServer(fact, appName)) {
      if (!launchersOfServers.has(fact.pid)) kinds.set(fact.pid, serverKind);
    } else if (isAppElectron(fact, appName)) {
      if (hasTestEnvironment(fact)) kinds.set(fact.pid, 'test-server');
    } else if (fact.markers.sessionId !== undefined && byPid.get(fact.ppid)?.markers.sessionId !== fact.markers.sessionId) {
      kinds.set(fact.pid, 'claude-session');
    }
  }
  return kinds;
}
