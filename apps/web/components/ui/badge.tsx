import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-sky-300/30 bg-sky-500/20 text-sky-200',
        muted: 'border-slate-600/50 bg-slate-800/60 text-slate-300',
        success: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
        warning: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
        danger: 'border-rose-400/40 bg-rose-500/20 text-rose-200',
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


