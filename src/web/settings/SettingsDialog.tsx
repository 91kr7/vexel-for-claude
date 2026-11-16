import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { Dialog } from '../dialogs/Dialog';
import type { NewerVersion } from '../newer-version/newer-version-loader';
import type { LookStore } from '../theme/look-store';
import type { ThemeStore } from '../theme/theme-store';
import { LookSection } from './LookSection';
import { ShortcutsSection } from './ShortcutsSection';
import { ThemeSection } from './ThemeSection';
import { UpdatesSection } from './UpdatesSection';

export type SettingsTab = 'theme' | 'look' | 'shortcuts' | 'updates';

const TABS: { tab: SettingsTab; title: string }[] = [
  { tab: 'theme', title: 'Theme' },
  { tab: 'look', title: 'Window Look' },
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
  if (tab === 'theme') return <ThemeSection store={themeStore} />;
  if (tab === 'look') return <LookSection store={lookStore} />;
  if (tab === 'updates') return <UpdatesSection onNewerVersion={onNewerVersion ?? (() => undefined)} />;
  return <ShortcutsSection />;
}

export function SettingsDialog({ initialTab = 'theme', onClose, themeStore, lookStore, onNewerVersion }: SettingsDialogProps) {
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
    if (event.key === 'ArrowRight') moveTo(index + 1);
    else if (event.key === 'ArrowLeft') moveTo(index - 1);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(TABS.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <Dialog title="Settings" onCancel={onClose} className="settings-dialog">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
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
            className={tab === id ? 'settings-tab selected' : 'settings-tab'}
            onClick={() => setTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {title}
          </button>
        ))}
      </div>
      {TABS.map(({ tab: id }) => (
        <div key={id} className="settings-tabpanel" role="tabpanel" id={panelId(id)} aria-labelledby={tabId(id)} hidden={tab !== id}>
          {(tab === id || id === 'updates') && (
            <Section tab={id} themeStore={themeStore} lookStore={lookStore} onNewerVersion={onNewerVersion} />
          )}
        </div>
      ))}
    </Dialog>
  );
}
