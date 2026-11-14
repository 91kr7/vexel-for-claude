import { Fragment, type ReactNode } from 'react';

type Block = { kind: 'heading'; text: string } | { kind: 'list'; items: string[] } | { kind: 'paragraph'; lines: string[] };

const HEADING = /^ {0,3}#{1,6}[ \t]+(.+)$/;
const ITEM = /^\s*[-*+][ \t]+(.*)$/;
// Addresses may hold one level of parentheses. Groups: 1 code, 2-3 link label and address, 4-5 bold, 6-7 italic. The image alternative has no group.
const INLINE =
  /`([^`]+)`|!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:[^*]*?[^*\s])?)\*|(?<![\p{L}\p{N}_])_([^_\s](?:[^_]*?[^_\s])?)_(?![\p{L}\p{N}_])/gu;

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  for (const line of text.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    const item = ITEM.exec(line);
    if (line.trim() === '') {
      current = undefined;
    } else if (heading) {
      blocks.push({ kind: 'heading', text: heading[1]!.trim() });
      current = undefined;
    } else if (item) {
      if (current?.kind === 'list') current.items.push(item[1]!);
      else blocks.push((current = { kind: 'list', items: [item[1]!] }));
    } else if (current?.kind === 'list' && /^\s/.test(line)) {
      current.items[current.items.length - 1] += ` ${line.trim()}`;
    } else if (current?.kind === 'paragraph') {
      current.lines.push(line.trim());
    } else {
      blocks.push((current = { kind: 'paragraph', lines: [line.trim()] }));
    }
  }
  return blocks;
}

function isWebAddress(address: string): boolean {
  try {
    const { protocol } = new URL(address);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function inlineOf(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    last = index + match[0].length;
    const key = `${keyPrefix}-${index}`;
    const [, code, label, address] = match;
    const bold = match[4] ?? match[5];
    const italic = match[6] ?? match[7];
    if (code !== undefined) nodes.push(<code key={key}>{code}</code>);
    else if (label !== undefined && address !== undefined) {
      const content = inlineOf(label, key);
      nodes.push(
        isWebAddress(address) ? (
          <a key={key} href={address} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          <Fragment key={key}>{content}</Fragment>
        ),
      );
    } else if (bold !== undefined) nodes.push(<strong key={key}>{inlineOf(bold, key)}</strong>);
    else if (italic !== undefined) nodes.push(<em key={key}>{inlineOf(italic, key)}</em>);
    // An image adds nothing.
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ChangelogText({ text }: { text: string }) {
  return (
    <div className="changelog-text">
      {blocksOf(text).map((block, index) => {
        const key = String(index);
        if (block.kind === 'heading') return <h4 key={key}>{inlineOf(block.text, key)}</h4>;
        if (block.kind === 'paragraph') return <p key={key}>{inlineOf(block.lines.join(' '), key)}</p>;
        return (
          <ul key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inlineOf(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
