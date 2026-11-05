import { CircleXIcon } from '../icons/Icons';

interface ErrorMessageProps {
  children: string;
  className?: string;
}

export function ErrorMessage({ children, className }: ErrorMessageProps) {
  return (
    <p className={className ? `error-message ${className}` : 'error-message'} role="alert">
      <CircleXIcon />
      {children}
    </p>
  );
}
