import { LoaderCircleIcon } from '../icons/Icons';

interface ProgressIndicatorProps {
  label?: string;
  className?: string;
}

export function Spinner() {
  return (
    <span className="spinner">
      <LoaderCircleIcon />
    </span>
  );
}

export function ProgressIndicator({ label = 'Loading…', className }: ProgressIndicatorProps) {
  return (
    <p className={className ? `progress-indicator ${className}` : 'progress-indicator'} role="status">
      <Spinner />
      {label}
    </p>
  );
}
