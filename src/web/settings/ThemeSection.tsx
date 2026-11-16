import { useId } from 'react';
import { type Theme, type ThemeStore, useTheme } from '../theme/theme-store';

const CHOICES: { theme: Theme; label: string }[] = [
  { theme: 'light', label: 'Light' },
  { theme: 'dark', label: 'Dark' },
];

export function ThemeSection({ store }: { store?: ThemeStore }) {
  const { theme, toggleTheme } = useTheme(store);
  const name = useId();
  return (
    <fieldset className="settings-choice">
      <legend className="section-label">Theme</legend>
      {CHOICES.map((choice) => (
        <label key={choice.theme} className="settings-option">
          <input
            type="radio"
            className="dialog-radio"
            name={name}
            checked={theme === choice.theme}
            onChange={() => {
              if (theme !== choice.theme) toggleTheme();
            }}
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  );
}
