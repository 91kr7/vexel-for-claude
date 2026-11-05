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

export function SquareTerminalIcon() {
  return (
    <LucideIcon>
      <path d="m7 11 2-2-2-2" />
      <path d="M11 13h4" />
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    </LucideIcon>
  );
}

export function CircleAlertIcon() {
  return (
    <LucideIcon>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </LucideIcon>
  );
}

export function TriangleAlertIcon() {
  return (
    <LucideIcon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </LucideIcon>
  );
}

export function LoaderCircleIcon() {
  return (
    <LucideIcon>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </LucideIcon>
  );
}

export function CirclePauseIcon() {
  return (
    <LucideIcon>
      <circle cx="12" cy="12" r="10" />
      <line x1="10" x2="10" y1="15" y2="9" />
      <line x1="14" x2="14" y1="15" y2="9" />
    </LucideIcon>
  );
}

export function CircleOffIcon() {
  return (
    <LucideIcon>
      <path d="m2 2 20 20" />
      <path d="M8.35 2.69A10 10 0 0 1 21.3 15.65" />
      <path d="M19.08 19.08A10 10 0 1 1 4.92 4.92" />
    </LucideIcon>
  );
}

export function TerminalIcon() {
  return (
    <LucideIcon>
      <path d="M12 19h8" />
      <path d="m4 17 6-6-6-6" />
    </LucideIcon>
  );
}

export function LockIcon() {
  return (
    <LucideIcon>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </LucideIcon>
  );
}

export function WrenchIcon() {
  return (
    <LucideIcon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
    </LucideIcon>
  );
}

export function ChevronRightIcon() {
  return (
    <LucideIcon>
      <path d="m9 18 6-6-6-6" />
    </LucideIcon>
  );
}

export function ChevronDownIcon() {
  return (
    <LucideIcon>
      <path d="m6 9 6 6 6-6" />
    </LucideIcon>
  );
}

export function CircleXIcon() {
  return (
    <LucideIcon>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </LucideIcon>
  );
}
