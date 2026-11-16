import type { KeyPress } from './shortcut-map';

export type ReservedKeyOwner = 'Claude Code' | 'the desktop' | 'the browser';

type Modifiers = 'Ctrl' | 'Alt' | 'Ctrl+Shift' | 'Alt+Shift' | 'Ctrl+Alt' | 'Ctrl+Alt+Shift';

function modifiersOf(press: KeyPress): string {
  return [press.ctrlKey && 'Ctrl', press.altKey && 'Alt', press.shiftKey && 'Shift'].filter(Boolean).join('+');
}

const is = (press: KeyPress, modifiers: Modifiers, codes: readonly string[]) =>
  modifiersOf(press) === modifiers && press.code !== undefined && codes.includes(press.code);

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((letter) => `Key${letter}`);
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const OWNERS: readonly { owner: ReservedKeyOwner; owns: (press: KeyPress) => boolean }[] = [
  {
    owner: 'Claude Code',
    owns: (press) =>
      is(press, 'Ctrl', LETTERS) ||
      is(press, 'Alt', ['KeyB', 'KeyD', 'KeyF', 'KeyO', 'KeyP', 'KeyT', 'KeyY', 'KeyM', 'KeyV']) ||
      is(press, 'Ctrl', ['Enter']) ||
      is(press, 'Ctrl+Shift', ['Minus']),
  },
  {
    owner: 'the desktop',
    owns: (press) =>
      press.metaKey ||
      is(press, 'Alt', ['Tab', 'F1', 'F2', 'F4', 'F7', 'F8', 'F10', 'Space']) ||
      is(press, 'Alt+Shift', ['Tab']) ||
      is(press, 'Ctrl+Alt', ARROWS) ||
      is(press, 'Ctrl+Alt+Shift', ARROWS) ||
      is(press, 'Ctrl+Alt', ['KeyT', 'Delete']),
  },
  {
    owner: 'the browser',
    owns: (press) =>
      is(press, 'Ctrl+Shift', ['KeyT', 'KeyN', 'KeyW', 'Tab']) || is(press, 'Ctrl', ['Tab', 'PageUp', 'PageDown']),
  },
];

export function reservedKeyOwner(press: KeyPress): ReservedKeyOwner | null {
  return OWNERS.find(({ owns }) => owns(press))?.owner ?? null;
}
