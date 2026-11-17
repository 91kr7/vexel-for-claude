import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { LookStore } from '../theme/look-store';
import { type Theme, ThemeStore } from '../theme/theme-store';

const roots: Root[] = [];

export function unmountAll(): void {
  for (const root of roots.splice(0)) flushSync(() => root.unmount());
  document.body.innerHTML = '';
}

// The shell may export NODE_ENV=production, where React has no `act`: flushSync commits at once.
export function mount(node: ReactNode): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  flushSync(() => root.render(node));
  return host;
}

export function rerenderLast(node: ReactNode): void {
  const root = roots[roots.length - 1];
  if (root) flushSync(() => root.render(node));
}

export const run = (action: () => void): void => flushSync(action);

export function keydown(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  flushSync(() => target.dispatchEvent(event));
  return event;
}

function fakeRoot() {
  return { setAttribute: vi.fn() };
}

export function themeStore(initial: Theme) {
  const store = new ThemeStore(fakeRoot(), initial);
  const toggle = vi.spyOn(store, 'toggle');
  const setTheme = vi.spyOn(store, 'setTheme');
  return { store, toggle, setTheme };
}

export function lookStore(initial: 'vexel' | 'windows11') {
  const store = new LookStore(fakeRoot(), initial);
  const toggle = vi.spyOn(store, 'toggle');
  return { store, toggle };
}

export const radios = (host: ParentNode): HTMLInputElement[] => [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

export const labelOf = (radio: HTMLInputElement): string => radio.closest('label')?.textContent?.trim() ?? '';
