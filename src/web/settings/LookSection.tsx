import { type ReactNode, useId } from 'react';
import { MacWindowIcon, WindowsLogoIcon } from '../icons/Icons';
import { type Look, type LookStore, useLook } from '../theme/look-store';
import { ChoiceCard } from './ChoiceCard';

const CHOICES: { look: Look; label: string; icon: ReactNode }[] = [
  { look: 'vexel', label: 'macOS', icon: <MacWindowIcon /> },
  { look: 'windows11', label: 'Windows 11', icon: <WindowsLogoIcon /> },
];

function LookPreview({ look }: { look: Look }) {
  return (
    <span className={`look-preview look-preview-${look}`}>
      <span className="look-preview-bar">
        <span className="look-preview-button" />
        <span className="look-preview-button" />
        <span className="look-preview-button" />
      </span>
      <span className="look-preview-body">
        <span className="look-preview-line" />
        <span className="look-preview-line short" />
      </span>
    </span>
  );
}

export function LookSection({ store }: { store?: LookStore }) {
  const { look, toggleLook } = useLook(store);
  const name = useId();
  return (
    <fieldset className="settings-choice">
      <legend className="settings-group-title">Window Look</legend>
      <div className="settings-cards">
        {CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.look}
            name={name}
            label={choice.label}
            icon={choice.icon}
            preview={<LookPreview look={choice.look} />}
            checked={look === choice.look}
            onChoose={() => {
              if (look !== choice.look) toggleLook();
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
