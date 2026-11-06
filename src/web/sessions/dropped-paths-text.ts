const PLAIN_PATH = /^[\p{L}\p{N}/._+,:=@%-]+$/u;

function shellWord(path: string): string {
  return PLAIN_PATH.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`;
}

export function droppedPathsText(paths: readonly string[]): string {
  return paths.map((path) => `${shellWord(path)} `).join('');
}
