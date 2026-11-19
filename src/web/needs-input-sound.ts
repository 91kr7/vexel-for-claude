import { useEffect } from 'react';
import { onSoundRequest } from './desktop-bridge';
import chimeUrl from './sounds/needs-input-chime.wav';

export function playNeedsInputSound(): void {
  try {
    new Audio(chimeUrl).play().catch(() => {});
  } catch {
    // A failed play must never reach the page (plan-input_sound/REQ-9).
  }
}

export function useNeedsInputSound(): void {
  useEffect(() => onSoundRequest(playNeedsInputSound), []);
}
