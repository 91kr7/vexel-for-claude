const WEB_SCHEMES = new Set(['http:', 'https:']);

export function isWebAddress(address: string): boolean {
  try {
    return WEB_SCHEMES.has(new URL(address).protocol);
  } catch {
    return false;
  }
}

export function openLink(address: string): void {
  if (isWebAddress(address)) window.open(address, '_blank', 'noopener,noreferrer');
}
