import type { ProcessKind } from './processes-client';

export const PROCESS_KIND_TEXTS: Record<ProcessKind, string> = {
  'app-server': 'App server',
  'test-server': 'Test server',
  'fake-claude': 'Fake Claude',
  'claude-session': 'Claude session',
};
