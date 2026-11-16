import type { ReactNode } from 'react';
import { CheckIcon } from '../icons/Icons';

interface ChoiceCardProps {
  name: string;
  label: string;
  icon: ReactNode;
  preview: ReactNode;
  checked: boolean;
  onChoose: () => void;
}

export function ChoiceCard({ name, label, icon, preview, checked, onChoose }: ChoiceCardProps) {
  return (
    <label className={checked ? 'settings-card checked' : 'settings-card'}>
      <input type="radio" className="settings-card-input" name={name} checked={checked} onChange={onChoose} />
      <span className="settings-card-preview" aria-hidden="true">
        {preview}
      </span>
      <span className="settings-card-footer">
        {icon}
        <span className="settings-card-label">{label}</span>
        {checked && (
          <span className="settings-card-check">
            <CheckIcon />
          </span>
        )}
      </span>
    </label>
  );
}
