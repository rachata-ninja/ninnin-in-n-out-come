import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';

type ConfirmDialogProps = {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  trigger: ReactNode;
};

export function ConfirmDialog({
  cancelLabel = 'ยกเลิก',
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  trigger,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description className="dialog-description">
            {description}
          </AlertDialog.Description>
          {children}
          <div className="confirm-actions">
            <AlertDialog.Cancel asChild>
              <button className="secondary-button" type="button">
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className="danger-button" type="button" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
