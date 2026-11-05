import { Dialog, type DialogProps } from './Dialog';

type WarningDialogProps = Omit<DialogProps, 'tone' | 'initialFocus'>;

export function WarningDialog(props: WarningDialogProps) {
  return <Dialog {...props} tone="warning" initialFocus="cancel" />;
}
