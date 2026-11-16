import { useId } from 'react';
import { type Look, type LookStore, useLook } from '../theme/look-store';

const CHOICES: { look: Look; label: string }[] = [
  { look: 'vexel', label: 'macOS' },
  { look: 'windows11', label: 'Windows 11' },
];

export function LookSection({ store }: { store?: LookStore }) {
  const { look, toggleLook } = useLook(store);
  const name = useId();
  return (
    <fieldset className="settings-choice">
      <legend className="section-label">Window Look</legend>
      {CHOICES.map((choice) => (
        <label key={choice.look} className="settings-option">
          <input
            type="radio"
            className="dialog-radio"
            name={name}
            checked={look === choice.look}
            onChange={() => {
              if (look !== choice.look) toggleLook();
            }}
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  );
}
