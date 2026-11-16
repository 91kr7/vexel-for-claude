import { type ReactNode, useId } from 'react';
import { MoonIcon, SunIcon } from '../icons/Icons';
import { type Theme, type ThemeStore, useTheme } from '../theme/theme-store';
import { ChoiceCard } from './ChoiceCard';

const CHOICES: { theme: Theme; label: string; icon: ReactNode }[] = [
  { theme: 'light', label: 'Light', icon: <SunIcon /> },
  { theme: 'dark', label: 'Dark', icon: <MoonIcon /> },
];

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span className={`theme-preview theme-preview-${theme}`}>
      <span className="theme-preview-bar" />
      <span className="theme-preview-main">
        <span className="theme-preview-side" />
        <span className="theme-preview-lines">
          <span className="theme-preview-line accent" />
          <span className="theme-preview-line" />
          <span className="theme-preview-line short" />
        </span>
      </span>
    </span>
  );
}

export function ThemeSection({ store }: { store?: ThemeStore }) {
  const { theme, toggleTheme } = useTheme(store);
  const name = useId();
  return (
    <fieldset className="settings-choice">
      <legend className="settings-group-title">Theme</legend>
      <div className="settings-cards">
        {CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.theme}
            name={name}
            label={choice.label}
            icon={choice.icon}
            preview={<ThemePreview theme={choice.theme} />}
            checked={theme === choice.theme}
            onChoose={() => {
              if (theme !== choice.theme) toggleTheme();
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
