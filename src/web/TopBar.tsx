import { isDesktopWindow } from './desktop-bridge';
import { PlusIcon } from './icons/Icons';
import { useInstalledVersion } from './installed-version-loader';
import { LookSwitch } from './LookSwitch';
import { PlanUsageButton } from './PlanUsageButton';
import { ShortcutsButton } from './ShortcutsButton';
import { ThemeSwitch } from './ThemeSwitch';
import { useLook } from './theme/look-store';
import { WindowButtons } from './WindowButtons';

interface TopBarProps {
  onNewSession: () => void;
  shortcutsPanelOpen: boolean;
  onToggleShortcutsPanel: () => void;
  planUsageOpen: boolean;
  onTogglePlanUsage: () => void;
}

export function TopBar({ onNewSession, shortcutsPanelOpen, onToggleShortcutsPanel, planUsageOpen, onTogglePlanUsage }: TopBarProps) {
  const desktop = isDesktopWindow();
  const installedVersion = useInstalledVersion();
  const { look } = useLook();
  const windows11 = look === 'windows11';
  return (
    <header className={desktop ? 'top-bar top-bar-drag' : 'top-bar'}>
      <div className="top-bar-brand">
        {desktop && !windows11 && <WindowButtons look={look} />}
        <span className="logo-mark" aria-hidden="true">
          VX
        </span>
        <span className="top-bar-wordmark">
          <span className="top-bar-name">Vexel</span>
          <span className="top-bar-suffix">for Claude</span>
          {installedVersion !== null && <span className="top-bar-suffix">v{installedVersion}</span>}
        </span>
      </div>
      <div className="top-bar-actions">
        <ShortcutsButton open={shortcutsPanelOpen} onToggle={onToggleShortcutsPanel} />
        <ThemeSwitch />
        <LookSwitch />
        <PlanUsageButton open={planUsageOpen} onToggle={onTogglePlanUsage} />
        <button type="button" className="button-primary button-bar" onClick={onNewSession}>
          <PlusIcon />
          New Session
        </button>
        {desktop && windows11 && <WindowButtons look={look} />}
      </div>
    </header>
  );
}
