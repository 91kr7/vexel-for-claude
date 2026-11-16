import { reservedKeyOwner } from './reserved-keys';
import {
  activeKeys,
  defaultKeys,
  type KeyPress,
  keyMatches,
  type ShortcutId,
  type ShortcutKey,
  type ShortcutModifier,
  shortcutRows,
} from './shortcut-map';
import { pageUserShortcutKeys, type UserShortcutKeysStore } from './user-shortcut-keys';

export type KeyCheck = { accepted: true } | { accepted: false; message: string };

interface Candidate {
  key: ShortcutKey;
  press: KeyPress;
}

function pressOfKey(key: ShortcutKey): KeyPress {
  return {
    code: key.byCharacter ? undefined : key.code,
    key: key.byCharacter ? key.code : key.character,
    ctrlKey: key.modifiers.includes('Ctrl'),
    altKey: key.modifiers.includes('Alt'),
    shiftKey: key.modifiers.includes('Shift'),
    metaKey: false,
  };
}

export function modifiersOfPress(press: KeyPress): ShortcutModifier[] {
  const modifiers: ShortcutModifier[] = [];
  if (press.ctrlKey) modifiers.push('Ctrl');
  if (press.altKey) modifiers.push('Alt');
  if (press.shiftKey) modifiers.push('Shift');
  return modifiers;
}

function check(id: ShortcutId, candidates: readonly Candidate[], store: UserShortcutKeysStore): KeyCheck {
  for (const { press } of candidates) {
    if ((!press.ctrlKey && !press.altKey) || press.altGraph === true) return { accepted: false, message: 'Use Ctrl or Alt in the shortcut' };
  }
  for (const { press } of candidates) {
    const owner = reservedKeyOwner(press);
    if (owner) return { accepted: false, message: `Used by ${owner}` };
  }
  const others = shortcutRows(store).filter((row) => row.id !== id);
  for (const { key, press } of candidates) {
    const taken = others.find((row) => row.keys.some((other) => keyMatches(other, press) || keyMatches(key, pressOfKey(other))));
    if (taken) return { accepted: false, message: `Already used by ${taken.action}` };
  }
  return { accepted: true };
}

export function checkPress(id: ShortcutId, press: KeyPress, store: UserShortcutKeysStore = pageUserShortcutKeys()): KeyCheck {
  const command = activeKeys(id, store)[0]?.command ?? { kind: 'terminal' };
  const key: ShortcutKey = { code: press.code ?? '', modifiers: modifiersOfPress(press), command, character: press.key };
  return check(id, [{ key, press }], store);
}

export function checkDefaultKeys(id: ShortcutId, store: UserShortcutKeysStore = pageUserShortcutKeys()): KeyCheck {
  return check(
    id,
    defaultKeys(id).map((key) => ({ key, press: pressOfKey(key) })),
    store,
  );
}
