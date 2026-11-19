import { type SoundSwitchStore, useSoundSwitch } from './sound-switch-store';

export function SoundSection({ store }: { store?: SoundSwitchStore }) {
  const { on, setOn } = useSoundSwitch(store);
  return (
    <section className="sound-card">
      <button type="button" role="switch" aria-checked={on} className="sound-switch" onClick={() => setOn(!on)}>
        <span className="sound-switch-label">Play a sound when a session needs input</span>
        <span className="sound-switch-track" aria-hidden="true">
          <span className="sound-switch-knob" />
        </span>
      </button>
    </section>
  );
}
