import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-700/40', className)} />;
}

export { Skeleton };


