import { MoonIcon, SunIcon } from './icons/Icons';
import { type ThemeStore, useTheme } from './theme/theme-store';

const NAME = 'Dark theme';

export function ThemeSwitch({ store }: { store?: ThemeStore }) {
  const { theme, toggleTheme } = useTheme(store);
  const dark = theme === 'dark';
  return (
    <button type="button" className="vx-surface-1 theme-switch" aria-label={NAME} title={NAME} aria-pressed={dark} onClick={toggleTheme}>
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
