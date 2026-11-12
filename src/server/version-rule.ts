const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function partsOf(version: string): [number, number, number] | undefined {
  const match = VERSION.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function newerVersionOf(tag: string, installedVersion: string): string | null {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  const release = partsOf(version);
  const installed = partsOf(installedVersion);
  if (!release || !installed) return null;
  for (let index = 0; index < 3; index += 1) {
    if (release[index]! !== installed[index]!) return release[index]! > installed[index]! ? version : null;
  }
  return null;
}
