import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { TriangleAlertIcon } from '../icons/Icons';

export interface DialogProps {
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onCancel: () => void;
  initialFocus?: 'dialog' | 'cancel';
  formName?: string;
  className?: string;
  tone?: 'default' | 'warning';
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  onCancel,
  initialFocus = 'dialog',
  formName,
  className,
  tone = 'default',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [previousFocus] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  const warning = tone === 'warning';

  useEffect(() => {
    const frame = frameRef.current;
    if (frame && !frame.contains(document.activeElement)) frame.focus();
    return () => {
      // StrictMode re-runs effects on a frame that is still mounted: restore focus only on a real close.
      if (frame?.isConnected) return;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [previousFocus]);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter') {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (!primaryDisabled) onPrimary();
    } else if (event.key === 'Tab') {
      keepFocusInside(event);
    }
  };

  return (
    <div
      className={warning ? 'modal-backdrop warning-backdrop' : 'modal-backdrop'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={frameRef}
        className={['modal', warning ? 'dialog-warning' : '', className ?? ''].filter(Boolean).join(' ')}
        role={warning ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <form className="dialog-form" aria-label={formName} onSubmit={(event) => event.preventDefault()}>
          <h2 id={titleId}>
            {warning && <TriangleAlertIcon />}
            {title}
          </h2>
          {description !== undefined && <p id={descriptionId}>{description}</p>}
          {children}
          <div className="modal-actions">
            <button type="button" onClick={onCancel} autoFocus={initialFocus === 'cancel'}>
              Annulla
            </button>
            <button
              type="button"
              className={warning ? 'button-danger' : 'button-primary'}
              onClick={onPrimary}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
