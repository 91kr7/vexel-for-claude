export const REPOSITORY_COLOR_TOKENS = ['--repo-color-1', '--repo-color-2', '--repo-color-3', '--repo-color-4', '--repo-color-5', '--repo-color-6'] as const;

/** The colour of the repository at `index` of the repository list; the palette repeats after its last colour. */
export function repositoryColor(index: number): string {
  const size = REPOSITORY_COLOR_TOKENS.length;
  return `var(${REPOSITORY_COLOR_TOKENS[((index % size) + size) % size]})`;
}
