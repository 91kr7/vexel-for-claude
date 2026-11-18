import { useCallback, useEffect, useRef, useState } from 'react';
import { quitApp as quitDesktopApp } from '../desktop-bridge';
import { AreaState } from '../feedback/AreaState';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Spinner } from '../feedback/ProgressIndicator';
import { ExitPresence } from '../motion/ExitPresence';
import { PROCESS_KIND_TEXTS } from './process-kind-texts';
import {
  loadProcesses,
  type ProcessesResult,
  type ProcessRow,
  type TerminateOutcome,
  terminateProcess,
} from './processes-client';
import { runningTimeText } from './running-time';
import { SettingsPane } from './SettingsPane';
import { TerminateProcessDialog } from './TerminateProcessDialog';

interface ProcessesSectionProps {
  load?: (signal?: AbortSignal) => Promise<ProcessesResult>;
  terminate?: (pid: number, startedAt: number) => Promise<TerminateOutcome>;
  quitApp?: () => void;
  now?: () => number;
}

const OUTCOME_ERRORS: Partial<Record<TerminateOutcome, string>> = {
  running: 'The process did not end.',
  not_allowed: 'You are not allowed to end this process.',
  failed: 'Could not terminate the process.',
};

/** PID and start time name one process run, so a reused PID never gets the old row's error or busy state. */
const rowKey = (row: Pick<ProcessRow, 'pid' | 'startedAt'>) => `${row.pid}:${row.startedAt}`;

interface RowActions {
  busy: ReadonlySet<string>;
  errors: ReadonlyMap<string, string>;
  onTerminate: (row: ProcessRow) => void;
}

function ProcessItem({ row, now, actions }: { row: ProcessRow; now: number; actions: RowActions }) {
  const key = rowKey(row);
  const busy = actions.busy.has(key);
  const error = actions.errors.get(key);
  const details = [
    row.label,
    `PID ${row.pid}`,
    row.port !== undefined ? `Port ${row.port}` : undefined,
    `Running ${runningTimeText(row.startedAt, now)}`,
    row.folder,
  ].filter((detail): detail is string => detail !== undefined);
  return (
    <li className="processes-row list-row">
      <span className="processes-row-head">
        <span className="processes-kind">{PROCESS_KIND_TEXTS[row.kind]}</span>
        {row.thisInstance && <span className="mono-chip process-mark process-mark-instance">This instance</span>}
        {row.hosted && <span className="mono-chip process-mark">Hosted here</span>}
        {row.hanging && <span className="mono-chip process-mark process-mark-hanging">Hanging</span>}
        <button
          type="button"
          className="button-danger process-terminate"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => actions.onTerminate(row)}
        >
          {busy && <Spinner />}
          Terminate
        </button>
      </span>
      <span className="processes-details">
        {details.map((detail, index) => (
          <span key={index} className="processes-detail">
            {detail}
          </span>
        ))}
      </span>
      {error !== undefined && <ErrorMessage className="process-error">{error}</ErrorMessage>}
    </li>
  );
}

function SectionBody({ result, now, actions }: { result: ProcessesResult | null; now: number; actions: RowActions }) {
  if (result === null) return <AreaState kind="loading" size="compact" title="Loading processes…" />;
  if (result.status === 'failed') return <AreaState kind="error" size="compact" title="Could not load the processes." />;
  if (result.processes.length === 0) return <AreaState kind="empty" size="compact" title="No app processes are running." />;
  return (
    <ul className="processes-rows" aria-label="Processes">
      {result.processes.map((row) => (
        <ProcessItem key={rowKey(row)} row={row} now={now} actions={actions} />
      ))}
    </ul>
  );
}

export function ProcessesSection({
  load = loadProcesses,
  terminate = terminateProcess,
  quitApp = quitDesktopApp,
  now = Date.now,
}: ProcessesSectionProps) {
  const [result, setResult] = useState<ProcessesResult | null>(null);
  const [confirming, setConfirming] = useState<ProcessRow | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const controllerRef = useRef<AbortController | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const mountedRef = useRef(true);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setResult(null);
    void loadRef.current(controller.signal).then((loaded) => {
      if (!controller.signal.aborted) setResult(loaded);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [reload]);

  const runTerminate = async (row: ProcessRow) => {
    const key = rowKey(row);
    setConfirming(null);
    setBusy((current) => new Set(current).add(key));
    const outcome = await terminate(row.pid, row.startedAt);
    if (row.thisInstance && outcome === 'ended') quitApp();
    if (!mountedRef.current) return;
    setBusy((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setErrors((current) => {
      const next = new Map(current);
      const error = OUTCOME_ERRORS[outcome];
      if (error === undefined) next.delete(key);
      else next.set(key, error);
      return next;
    });
    reload();
  };

  const actions: RowActions = { busy, errors, onTerminate: setConfirming };

  const refreshButton = (
    <button type="button" className="button-neutral" onClick={reload}>
      Refresh
    </button>
  );

  return (
    <SettingsPane title="Processes" action={refreshButton} bodyLabel="Process List">
      <SectionBody result={result} now={now()} actions={actions} />
      <ExitPresence>
        {confirming && (
          <TerminateProcessDialog
            row={confirming}
            onConfirm={() => void runTerminate(confirming)}
            onCancel={() => setConfirming(null)}
          />
        )}
      </ExitPresence>
    </SettingsPane>
  );
}
