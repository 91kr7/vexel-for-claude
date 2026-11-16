// Tests of plan-settings_dialog, batch editable-shortcuts: ReservedKeys spec.
import { describe, expect, it } from 'vitest';
import { reservedKeyOwner } from './reserved-keys';
import type { KeyPress } from './shortcut-map';

type Modifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

/** A press written as "Ctrl+Shift+KeyT": the modifiers, then the physical key. */
const press = (combo: string, key?: string): KeyPress => {
  const parts = combo.split('+');
  const code = parts.pop()!;
  const has = (modifier: Modifier) => parts.includes(modifier);
  return { code, key: key ?? code, ctrlKey: has('Ctrl'), altKey: has('Alt'), shiftKey: has('Shift'), metaKey: has('Meta'), altGraph: false };
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

describe('reservedKeyOwner', () => {
  // plan-settings_dialog/REQ-29, ReservedKeys table: Ctrl with any letter, alone, belongs to Claude Code
  it.each(LETTERS)('gives Claude Code for Ctrl+%s', (letter) => {
    expect(reservedKeyOwner(press(`Ctrl+Key${letter}`))).toBe('Claude Code');
  });

  // plan-settings_dialog/REQ-29, ReservedKeys table: Alt with B, D, F, O, P, T, Y, M or V, alone, belongs to Claude Code
  it.each(['B', 'D', 'F', 'O', 'P', 'T', 'Y', 'M', 'V'])('gives Claude Code for Alt+%s', (letter) => {
    expect(reservedKeyOwner(press(`Alt+Key${letter}`))).toBe('Claude Code');
  });

  // plan-settings_dialog/REQ-29, ReservedKeys table: Ctrl+Enter and Ctrl+Shift+- belong to Claude Code
  it('gives Claude Code for Ctrl+Enter and Ctrl+Shift+-', () => {
    expect(reservedKeyOwner(press('Ctrl+Enter'))).toBe('Claude Code');
    expect(reservedKeyOwner(press('Ctrl+Shift+Minus', '_'))).toBe('Claude Code');
  });

  // ReservedKeys contract: "alone" means no other modifier, so an extra modifier frees the combination
  it.each(['Ctrl+Shift+KeyK', 'Ctrl+Alt+KeyK', 'Alt+Shift+KeyB', 'Ctrl+Alt+KeyB'])('gives no owner for %s', (combo) => {
    expect(reservedKeyOwner(press(combo))).toBeNull();
  });

  // plan-settings_dialog/REQ-29, ReservedKeys table: any press with Meta belongs to the desktop
  it.each(['Meta+KeyK', 'Ctrl+Meta+KeyK', 'Alt+Meta+Digit1', 'Ctrl+Alt+Shift+Meta+F5'])('gives the desktop for %s', (combo) => {
    expect(reservedKeyOwner(press(combo))).toBe('the desktop');
  });

  // plan-settings_dialog/REQ-29, ReservedKeys table: the desktop keys of Ubuntu GNOME
  it.each([
    'Alt+Tab',
    'Alt+Shift+Tab',
    'Alt+F1',
    'Alt+F2',
    'Alt+F4',
    'Alt+F7',
    'Alt+F8',
    'Alt+F10',
    'Alt+Space',
    'Ctrl+Alt+ArrowUp',
    'Ctrl+Alt+ArrowDown',
    'Ctrl+Alt+ArrowLeft',
    'Ctrl+Alt+ArrowRight',
    'Ctrl+Alt+Shift+ArrowUp',
    'Ctrl+Alt+Shift+ArrowLeft',
    'Ctrl+Alt+KeyT',
    'Ctrl+Alt+Delete',
  ])('gives the desktop for %s', (combo) => {
    expect(reservedKeyOwner(press(combo))).toBe('the desktop');
  });

  // plan-settings_dialog/REQ-29, ReservedKeys table: the keys the browser keeps
  it.each(['Ctrl+Shift+KeyT', 'Ctrl+Shift+KeyN', 'Ctrl+Shift+KeyW', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown'])(
    'gives the browser for %s',
    (combo) => {
      expect(reservedKeyOwner(press(combo))).toBe('the browser');
    },
  );

  // ReservedKeys contract: the owners are checked in order, so Ctrl+T, Ctrl+W and Ctrl+N name Claude Code
  it.each(['Ctrl+KeyT', 'Ctrl+KeyW', 'Ctrl+KeyN'])('gives Claude Code, not the browser, for %s', (combo) => {
    expect(reservedKeyOwner(press(combo))).toBe('Claude Code');
  });

  // ReservedKeys contract: the keys are physical keys, whatever character the layout types
  it('matches the physical key, not the typed character', () => {
    expect(reservedKeyOwner(press('Ctrl+KeyT', 'z'))).toBe('Claude Code');
    expect(reservedKeyOwner(press('Alt+KeyB', '∫'))).toBe('Claude Code');
    expect(reservedKeyOwner(press('Alt+KeyK', 'b'))).toBeNull();
  });

  // ReservedKeys contract: a combination no owner lists gives null
  it.each(['Alt+KeyK', 'Alt+KeyL', 'Alt+Shift+KeyK', 'Ctrl+Alt+KeyK', 'Alt+Digit1', 'Alt+F5', 'Ctrl+F5', 'Alt+ArrowUp', 'Alt+Enter'])('gives no owner for %s', (combo) => {
    expect(reservedKeyOwner(press(combo))).toBeNull();
  });
});
