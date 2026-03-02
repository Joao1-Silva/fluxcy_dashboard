'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { HTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;

function SheetPortal({ children }: { children: ReactNode }) {
  return <Dialog.Portal>{children}</Dialog.Portal>;
}

function SheetOverlay({ className, ...props }: Dialog.DialogOverlayProps) {
  return (
    <Dialog.Overlay
      className={cn('fixed inset-0 z-50 bg-[color:var(--overlay)] backdrop-blur-sm', className)}
      {...props}
    />
  );
}

function SheetContent({ className, children, ...props }: Dialog.DialogContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <Dialog.Content
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-[color:rgba(var(--primary-rgb),0.45)] bg-[color:rgba(var(--bg-rgb),0.96)] p-5 shadow-[var(--shadow)] backdrop-blur-xl data-[state=open]:animate-fadeIn',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 rounded-lg p-2 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </Dialog.Close>
      </Dialog.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

function SheetTitle({ className, ...props }: Dialog.DialogTitleProps) {
  return <Dialog.Title className={cn('text-lg font-semibold text-[color:var(--text)]', className)} {...props} />;
}

function SheetDescription({ className, ...props }: Dialog.DialogDescriptionProps) {
  return <Dialog.Description className={cn('text-sm text-[color:var(--text-muted)]', className)} {...props} />;
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};


