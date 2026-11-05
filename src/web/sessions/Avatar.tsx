import { TerminalIcon } from '../icons/Icons';
import type { SessionState } from './live-session-store';

export type AvatarSize = 'list' | 'header' | 'dialog';
export type AvatarVariant = 'external' | 'attn' | 'ended' | 'primary' | 'teal';

interface AvatarSubject {
  folder: string;
  state?: SessionState | undefined;
  external?: boolean | undefined;
}

export function folderNameOf(folder: string): string {
  return folder.split('/').filter((segment) => segment !== '').pop() ?? folder;
}

export function initialsOf(folder: string): string {
  const words = folderNameOf(folder)
    .split(/[-_ ]+/)
    .filter((word) => word !== '');
  const [first, second] = words;
  if (first === undefined) return '';
  const letters = second === undefined ? Array.from(first).slice(0, 2) : [Array.from(first)[0], Array.from(second)[0]];
  return letters.join('').toUpperCase();
}

function stableHash(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

export function avatarVariantOf({ folder, state, external }: AvatarSubject): AvatarVariant {
  if (external) return 'external';
  if (state === 'needs_input') return 'attn';
  if (state === 'ended') return 'ended';
  return stableHash(folder) % 2 === 0 ? 'primary' : 'teal';
}

interface AvatarProps extends AvatarSubject {
  size?: AvatarSize;
}

export function Avatar({ folder, state, external, size = 'list' }: AvatarProps) {
  const variant = avatarVariantOf({ folder, state, external });
  const text = size === 'header' ? 'title-m' : 'label-l';
  return (
    <span className={`avatar avatar-${size} avatar-${variant} ${text}`} aria-hidden="true">
      {variant === 'external' ? <TerminalIcon /> : initialsOf(folder)}
    </span>
  );
}
