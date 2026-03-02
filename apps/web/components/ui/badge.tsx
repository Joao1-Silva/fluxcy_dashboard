import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[color:var(--info)] bg-[color:var(--info-bg)] text-[color:var(--info)]',
        muted:
          'border-[color:rgba(var(--border-rgb),0.68)] bg-[color:rgba(var(--surface-2-rgb),0.72)] text-[color:var(--text-muted)]',
        success: 'border-[color:var(--success)] bg-[color:var(--success-bg)] text-[color:var(--success)]',
        warning: 'border-[color:var(--warning)] bg-[color:var(--warning-bg)] text-[color:var(--warning)]',
        danger: 'border-[color:var(--danger)] bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
        info: 'border-[color:var(--info)] bg-[color:var(--info-bg)] text-[color:var(--info)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };


