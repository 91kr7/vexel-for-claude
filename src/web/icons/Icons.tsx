import type { ReactNode } from 'react';

// Path data copied from lucide-static 1.69.0, or from the mock boards where they draw the icon (ISC, see LICENSE in this folder).
function LucideIcon({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      className={filled ? 'icon icon-filled' : 'icon'}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
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

export function MinusIcon() {
  return (
    <LucideIcon>
      <path d="M5 12h14" />
    </LucideIcon>
  );
}

export function HistoryIcon() {
  return (
    <LucideIcon>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </LucideIcon>
  );
}

const FOLDER_PATH = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

export function FolderIcon() {
  return (
    <LucideIcon>
      <path d={FOLDER_PATH} />
    </LucideIcon>
  );
}

export function FolderPlusIcon() {
  return (
    <LucideIcon>
      <path d="M12 10v6" />
      <path d="M9 13h6" />
      <path d={FOLDER_PATH} />
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

export function CircleMinusIcon() {
  return (
    <LucideIcon>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12h8" />
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

export function ChevronUpIcon() {
  return (
    <LucideIcon>
      <path d="m18 15-6-6-6 6" />
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

export function PencilIcon() {
  return (
    <LucideIcon>
      <path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
    </LucideIcon>
  );
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <LucideIcon filled={filled}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </LucideIcon>
  );
}

export function CheckIcon() {
  return (
    <LucideIcon>
      <path d="M20 6 9 17l-5-5" />
    </LucideIcon>
  );
}

export function ArrowDownIcon() {
  return (
    <LucideIcon>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </LucideIcon>
  );
}

export function SearchIcon() {
  return (
    <LucideIcon>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </LucideIcon>
  );
}

export function XIcon() {
  return (
    <LucideIcon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideIcon>
  );
}

export function Maximize2Icon() {
  return (
    <LucideIcon>
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </LucideIcon>
  );
}

export function Minimize2Icon() {
  return (
    <LucideIcon>
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </LucideIcon>
  );
}

export function SunIcon() {
  return (
    <LucideIcon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </LucideIcon>
  );
}

export function MoonIcon() {
  return (
    <LucideIcon>
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </LucideIcon>
  );
}

export function KeyboardIcon() {
  return (
    <LucideIcon>
      <path d="M10 8h.01" />
      <path d="M12 12h.01" />
      <path d="M14 8h.01" />
      <path d="M16 12h.01" />
      <path d="M18 8h.01" />
      <path d="M6 8h.01" />
      <path d="M7 16h10" />
      <path d="M8 12h.01" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </LucideIcon>
  );
}

export function GaugeIcon() {
  return (
    <LucideIcon>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </LucideIcon>
  );
}

export function GitBranchIcon() {
  return (
    <LucideIcon>
      <path d="M15 6a9 9 0 0 0-9 9V3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
    </LucideIcon>
  );
}

export function RefreshCwIcon() {
  return (
    <LucideIcon>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </LucideIcon>
  );
}

// Mock artwork, not a Lucide icon: a filled shape.
export function SparkIcon() {
  return (
    <svg className="spark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
    </svg>
  );
}

export function WindowsLogoIcon() {
  return (
    <LucideIcon>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </LucideIcon>
  );
}

export function MacWindowIcon() {
  return (
    <LucideIcon>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01" />
      <path d="M10 8h.01" />
      <path d="M14 8h.01" />
    </LucideIcon>
  );
}

// Thin Fluent-style caption glyphs for the Windows 11 window buttons, drawn on a 10x10 grid.
function CaptionGlyph({ children }: { children: ReactNode }) {
  return (
    <svg className="caption-glyph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function CaptionMinimizeGlyph() {
  return (
    <CaptionGlyph>
      <path d="M0 5.5h10" />
    </CaptionGlyph>
  );
}

export function CaptionMaximizeGlyph() {
  return (
    <CaptionGlyph>
      <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
    </CaptionGlyph>
  );
}

export function CaptionRestoreGlyph() {
  return (
    <CaptionGlyph>
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
      <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
    </CaptionGlyph>
  );
}

export function CaptionCloseGlyph() {
  return (
    <CaptionGlyph>
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </CaptionGlyph>
  );
}
