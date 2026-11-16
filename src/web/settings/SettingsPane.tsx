import type { ReactNode } from 'react';

interface SettingsPaneProps {
  title: string;
  action?: ReactNode;
  bodyLabel?: string;
  children: ReactNode;
}

export function SettingsPane({ title, action, bodyLabel, children }: SettingsPaneProps) {
  return (
    <>
      <div className="settings-pane-header">
        <h3 className="settings-pane-title">{title}</h3>
        {action}
      </div>
      <div
        className="settings-pane-body"
        role={bodyLabel === undefined ? undefined : 'region'}
        aria-label={bodyLabel}
        tabIndex={bodyLabel === undefined ? undefined : 0}
      >
        {children}
      </div>
    </>
  );
}
