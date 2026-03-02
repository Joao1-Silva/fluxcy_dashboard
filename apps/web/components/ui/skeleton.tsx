import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-[color:rgba(var(--surface-2-rgb),0.72)]', className)} />;
}

export { Skeleton };


