import { readdirSync, readFileSync } from 'node:fs';

// A quit that outlasts the specs' SIGKILL fallback leaves the backend and Electron helpers alive, holding Playwright's pipes past the worker teardown.
export function killLeftovers(home: string): void {
  const belongs = (pid: number) => {
    try {
      if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(home)) return true;
      return readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`HOME=${home}`);
    } catch {
      return false;
    }
  };
  for (const pid of readdirSync('/proc').filter((entry) => /^\d+$/.test(entry)).map(Number)) {
    if (pid === process.pid || !belongs(pid)) continue;
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}
