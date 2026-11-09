import { useEffect, useRef } from 'react';

export type SessionCommand = 'stop' | 'dismiss' | 'resume' | 'rename';

interface Subscriber {
  command: SessionCommand;
  run: () => void;
}

const subscribers: Subscriber[] = [];

export function useSessionCommand(command: SessionCommand, run: () => void, enabled = true): void {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!enabled) return;
    const subscriber: Subscriber = { command, run: () => runRef.current() };
    subscribers.push(subscriber);
    return () => {
      subscribers.splice(subscribers.indexOf(subscriber), 1);
    };
  }, [command, enabled]);
}

export function sendSessionCommand(command: SessionCommand): void {
  for (let index = subscribers.length - 1; index >= 0; index--) {
    const subscriber = subscribers[index];
    if (subscriber?.command === command) return subscriber.run();
  }
}
