import { useCallback, useEffect, useRef, useState } from 'react';
import { AreaState } from '../feedback/AreaState';
import { loadProcesses, type ProcessKind, type ProcessesResult, type ProcessRow } from './processes-client';
import { runningTimeText } from './running-time';
import { SettingsPane } from './SettingsPane';

interface ProcessesSectionProps {
  load?: (signal?: AbortSignal) => Promise<ProcessesResult>;
  now?: () => number;
}

const KIND_TEXTS: Record<ProcessKind, string> = {
  'app-server': 'App server',
  'test-server': 'Test server',
  'fake-claude': 'Fake Claude',
  'claude-session': 'Claude session',
};

function ProcessItem({ row, now }: { row: ProcessRow; now: number }) {
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
        <span className="processes-kind">{KIND_TEXTS[row.kind]}</span>
        {row.thisInstance && <span className="mono-chip process-mark process-mark-instance">This instance</span>}
        {row.hosted && <span className="mono-chip process-mark">Hosted here</span>}
        {row.hanging && <span className="mono-chip process-mark process-mark-hanging">Hanging</span>}
      </span>
      <span className="processes-details">
        {details.map((detail, index) => (
          <span key={index} className="processes-detail">
            {detail}
          </span>
        ))}
      </span>
    </li>
  );
}

function SectionBody({ result, now }: { result: ProcessesResult | null; now: number }) {
  if (result === null) return <AreaState kind="loading" size="compact" title="Loading processes…" />;
  if (result.status === 'failed') return <AreaState kind="error" size="compact" title="Could not load the processes." />;
  if (result.processes.length === 0) return <AreaState kind="empty" size="compact" title="No app processes are running." />;
  return (
    <ul className="processes-rows" aria-label="Processes">
      {result.processes.map((row) => (
        <ProcessItem key={row.pid} row={row} now={now} />
      ))}
    </ul>
  );
}

export function ProcessesSection({ load = loadProcesses, now = Date.now }: ProcessesSectionProps) {
  const [result, setResult] = useState<ProcessesResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

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
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  const refreshButton = (
    <button type="button" className="button-neutral" onClick={reload}>
      Refresh
    </button>
  );

  return (
    <SettingsPane title="Processes" action={refreshButton} bodyLabel="Process List">
      <SectionBody result={result} now={now()} />
    </SettingsPane>
  );
}
