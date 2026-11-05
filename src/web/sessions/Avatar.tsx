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

export function Avatar({ folder }: { folder: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initialsOf(folder)}
    </span>
  );
}
