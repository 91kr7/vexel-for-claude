import type { ReactNode } from 'react';

// Path data copied from lucide-static 1.69.0 (ISC, see LICENSE in this folder).
function LucideIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <LucideIcon>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </LucideIcon>
  );
}

export function HistoryIcon() {
  return (
    <LucideIcon>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </LucideIcon>
  );
}

export function CircleStopIcon() {
  return (
    <LucideIcon>
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </LucideIcon>
  );
}

export function PowerIcon() {
  return (
    <LucideIcon>
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
    </LucideIcon>
  );
}

export function LogInIcon() {
  return (
    <LucideIcon>
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </LucideIcon>
  );
}
