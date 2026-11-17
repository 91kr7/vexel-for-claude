import { useCallback, useEffect, useState } from 'react';
import { useLeaving } from './motion/ExitPresence';

const SHORT_MESSAGE_MS = 4000;

export function useShortMessage(): { text: string | null; show: (text: string) => void } {
  const [message, setMessage] = useState<{ text: string } | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), SHORT_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);
  const show = useCallback((text: string) => setMessage({ text }), []);
  return { text: message?.text ?? null, show };
}

export function ShortMessageToast({ text }: { text: string | null }) {
  const leaving = useLeaving();
  if (text === null) return null;
  return (
    <div className={leaving ? 'short-message vx-glass is-leaving' : 'short-message vx-glass'} role="status" aria-hidden={leaving || undefined}>
      <span className="short-message-dot" aria-hidden="true" />
      {text}
    </div>
  );
}
