import type { KeyboardEvent, RefObject } from 'react';
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from '../icons/Icons';

export interface TerminalSearchResults {
  index: number;
  total: number;
}

interface TerminalSearchBoxProps {
  query: string;
  results: TerminalSearchResults | null;
  inputRef?: RefObject<HTMLInputElement>;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

function resultsText(query: string, results: TerminalSearchResults | null): string {
  if (query === '' || !results) return '';
  if (results.total === 0) return 'No results';
  if (results.index < 0) return `${results.total}+ results`;
  return `${results.index + 1} of ${results.total}`;
}

export function TerminalSearchBox({ query, results, inputRef, onQueryChange, onNext, onPrevious, onClose }: TerminalSearchBoxProps) {
  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) onPrevious();
      else onNext();
    }
  };
  const onBoxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div className="terminal-search" role="search" aria-label="Terminal search" onKeyDown={onBoxKeyDown}>
      <SearchIcon />
      <input
        ref={inputRef}
        className="terminal-search-input"
        type="text"
        aria-label="Search in terminal"
        placeholder="Search"
        spellCheck={false}
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onFieldKeyDown}
      />
      <span className="terminal-search-count" role="status">
        {resultsText(query, results)}
      </span>
      <button type="button" className="terminal-search-button" aria-label="Previous match" title="Previous match (Shift+Enter)" onClick={onPrevious}>
        <ChevronUpIcon />
      </button>
      <button type="button" className="terminal-search-button" aria-label="Next match" title="Next match (Enter)" onClick={onNext}>
        <ChevronDownIcon />
      </button>
      <button type="button" className="terminal-search-button" aria-label="Close search" title="Close (Esc)" onClick={onClose}>
        <XIcon />
      </button>
    </div>
  );
}
