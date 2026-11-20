import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Spinner } from '../feedback/ProgressIndicator';
import { useLeaving } from '../motion/ExitPresence';
import { TriangleAlertIcon } from '../icons/Icons';

export interface DialogProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  onCancel: () => void;
  initialFocus?: 'dialog' | 'cancel';
  formName?: string;
  className?: string;
  tone?: 'default' | 'warning';
  accent?: 'error' | 'attn';
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

function primaryClass(warning: boolean, accent: 'error' | 'attn'): string {
  if (!warning) return 'button-primary';
  return accent === 'attn' ? 'button-attn' : 'button-danger';
}

export function Dialog({
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryBusy = false,
  onCancel,
  initialFocus = 'dialog',
  formName,
  className,
  tone = 'default',
  accent = 'error',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const leaving = useLeaving();
  const focusReturned = useRef(false);
  const [previousFocus] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  const warning = tone === 'warning';
  const attnBanner = warning && accent === 'attn';
  const primaryBlocked = primaryDisabled || primaryBusy;
  const hasPrimary = primaryLabel !== undefined && onPrimary !== undefined;

  const restoreFocus = () => {
    if (focusReturned.current) return;
    focusReturned.current = true;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (frame && !frame.contains(document.activeElement)) frame.focus();
    return () => {
      // StrictMode re-runs effects on a frame that is still mounted: restore focus only on a real close.
      if (frame?.isConnected) return;
      restoreFocus();
    };
  }, [previousFocus]);

  // A leaving dialog gives the focus back at once, so the page takes the next keys.
  useEffect(() => {
    const frame = frameRef.current;
    if (!leaving || !frame) return;
    if (!frame.contains(document.activeElement)) {
      // The focus already left: the final removal must not pull it back.
      focusReturned.current = true;
      return;
    }
    restoreFocus();
    if (frame.contains(document.activeElement) && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [leaving]);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    const frame = event.currentTarget;
    const isTabStop = (element: HTMLElement) =>
      !(element instanceof HTMLInputElement && element.type === 'radio' && !element.checked) ||
      frame.querySelector(`input[type="radio"][name="${CSS.escape(element.name)}"]:checked`) === null;
    const focusable = [...frame.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isTabStop);
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
    if (leaving) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter') {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (hasPrimary && !primaryBlocked) onPrimary();
    } else if (event.key === 'Tab') {
      keepFocusInside(event);
    }
  };

  const descriptionText = description !== undefined && (
    <p id={descriptionId} className="dialog-description">
      {description}
    </p>
  );

  return (
    <div
      className={['modal-backdrop', warning ? 'warning-backdrop' : '', leaving ? 'is-leaving' : ''].filter(Boolean).join(' ')}
      aria-hidden={leaving || undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={frameRef}
        className={['modal vx-surface-2 vx-popup-glass', warning ? `dialog-warning dialog-${accent}` : '', className ?? ''].filter(Boolean).join(' ')}
        role={warning ? 'alertdialog' : 'dialog'}
        aria-modal={leaving ? undefined : true}
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="dialog-header">
          <span className="dialog-dot" aria-hidden="true" />
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <button type="button" className="dialog-esc" aria-label="Close (Esc)" onClick={onCancel}>
            [Esc]
          </button>
        </div>
        <form className="dialog-form" aria-label={formName} onSubmit={(event) => event.preventDefault()}>
          <div className="dialog-body">
            {attnBanner ? (
              <div className="dialog-banner vx-surface-2">
                <TriangleAlertIcon />
                {descriptionText}
              </div>
            ) : (
              descriptionText
            )}
            {children}
          </div>
          <div className="modal-actions">
            <button type="button" className="button-neutral dialog-cancel" onClick={onCancel} autoFocus={initialFocus === 'cancel'}>
              {hasPrimary ? 'Cancel' : 'Close'}
            </button>
            {hasPrimary && (
              <button
                type="button"
                className={primaryClass(warning, accent)}
                onClick={onPrimary}
                disabled={primaryBlocked}
                aria-busy={primaryBusy || undefined}
              >
                {primaryBusy && <Spinner />}
                {primaryLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
