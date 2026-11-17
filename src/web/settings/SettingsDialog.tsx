import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import type { NewerVersion } from '../newer-version/newer-version-loader';
import type { LookStore } from '../theme/look-store';
import type { ThemeStore } from '../theme/theme-store';
import { LookSection } from './LookSection';
import { SettingsPane } from './SettingsPane';
import { ShortcutsSection } from './ShortcutsSection';
import { ThemeSection } from './ThemeSection';
import { UpdatesSection } from './UpdatesSection';

export type SettingsTab = 'appearance' | 'shortcuts' | 'updates';

const TABS: { tab: SettingsTab; title: string }[] = [
  { tab: 'appearance', title: 'Appearance' },
  { tab: 'shortcuts', title: 'Shortcuts' },
  { tab: 'updates', title: 'Updates' },
];

interface SettingsDialogProps {
  initialTab?: SettingsTab;
  onClose: () => void;
  themeStore?: ThemeStore;
  lookStore?: LookStore;
  onNewerVersion?: (version: NewerVersion) => void;
}

type SectionProps = Pick<SettingsDialogProps, 'themeStore' | 'lookStore' | 'onNewerVersion'> & { tab: SettingsTab };

function Section({ tab, themeStore, lookStore, onNewerVersion }: SectionProps) {
  if (tab === 'appearance') {
    return (
      <SettingsPane title="Appearance">
        <ThemeSection store={themeStore} />
        <LookSection store={lookStore} />
      </SettingsPane>
    );
  }
  if (tab === 'updates') {
    return (
      <SettingsPane title="Updates">
        <UpdatesSection onNewerVersion={onNewerVersion ?? (() => undefined)} />
      </SettingsPane>
    );
  }
  return <ShortcutsSection />;
}

export function SettingsDialog({ initialTab = 'appearance', onClose, themeStore, lookStore, onNewerVersion }: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const baseId = useId();
  const tabRefs = useRef(new Map<SettingsTab, HTMLButtonElement>());
  const tabId = (id: SettingsTab) => `${baseId}-tab-${id}`;
  const panelId = (id: SettingsTab) => `${baseId}-panel-${id}`;

  const moveTo = (index: number) => {
    const next = TABS[(index + TABS.length) % TABS.length];
    if (!next) return;
    setTab(next.tab);
    tabRefs.current.get(next.tab)?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') moveTo(index + 1);
    else if (event.key === 'ArrowUp') moveTo(index - 1);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(TABS.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <Dialog title="Settings" onCancel={onClose} className="settings-dialog">
      <div className="settings-layout">
        <div className="settings-menu" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
          {TABS.map(({ tab: id, title }, index) => (
            <button
              key={id}
              ref={(element) => {
                if (element) tabRefs.current.set(id, element);
                else tabRefs.current.delete(id);
              }}
              type="button"
              role="tab"
              id={tabId(id)}
              aria-selected={tab === id}
              aria-controls={panelId(id)}
              tabIndex={tab === id ? 0 : -1}
              autoFocus={tab === id}
              className={tab === id ? 'settings-menu-item list-row list-active selected' : 'settings-menu-item list-row'}
              onClick={() => setTab(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {title}
            </button>
          ))}
        </div>
        {TABS.map(({ tab: id }) => (
          <div key={id} className="settings-pane" role="tabpanel" id={panelId(id)} aria-labelledby={tabId(id)} hidden={tab !== id}>
            {(tab === id || id === 'updates') && (
              <Section tab={id} themeStore={themeStore} lookStore={lookStore} onNewerVersion={onNewerVersion} />
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
