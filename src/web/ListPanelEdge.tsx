import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { MIN_LIST_WIDTH } from './list-width-store';

const KEY_STEP = 16;

interface ListPanelEdgeProps {
  width: number;
  maxWidth: number;
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startWidth: number;
  width: number;
}

export function ListPanelEdge({ width, maxWidth, onPreview, onCommit }: ListPanelEdgeProps) {
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const keptInLimits = (next: number) => Math.min(Math.max(Math.round(next), MIN_LIST_WIDTH), maxWidth);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, width };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = keptInLimits(current.startWidth + event.clientX - current.startX);
    if (next === current.width) return;
    current.width = next;
    onPreview(next);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (current.width !== current.startWidth) onCommit(current.width);
  };

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    const next = keptInLimits(width + direction * KEY_STEP);
    if (next !== width) onCommit(next);
  };

  return (
    <div
      className={dragging ? 'list-panel-edge dragging' : 'list-panel-edge'}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Session List"
      aria-valuenow={width}
      aria-valuemin={MIN_LIST_WIDTH}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={step}
    />
  );
}
