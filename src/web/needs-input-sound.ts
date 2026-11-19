import { useEffect } from 'react';
import { onSoundRequest } from './desktop-bridge';
import { pageSoundSwitchStore, type SoundSwitchStore } from './settings/sound-switch-store';
import chimeUrl from './sounds/needs-input-chime.wav';

export function playNeedsInputSound(): void {
  try {
    new Audio(chimeUrl).play().catch(() => {});
  } catch {
    // A failed play must never reach the page (plan-input_sound/REQ-9).
  }
}

export function useNeedsInputSound(store: SoundSwitchStore = pageSoundSwitchStore()): void {
  useEffect(
    () =>
      onSoundRequest(() => {
        if (store.getSnapshot()) playNeedsInputSound();
      }),
    [store],
  );
}
