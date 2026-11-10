export const firstLineOf = (message: string) => message.split('\n', 1)[0] ?? '';

/** Local date and time, e.g. "10/11/2026 15:25". */
export function formatCommitDate(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
