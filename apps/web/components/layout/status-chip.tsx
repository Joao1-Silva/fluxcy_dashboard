import type { ReactNode } from 'react';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusChipProps = {
  status: 'connected' | 'polling' | 'error';
};

const statusStyles: Record<StatusChipProps['status'], { label: string; icon: ReactNode; className: string }> = {
  connected: {
    label: 'Connected',
    icon: <Wifi className="h-3.5 w-3.5" />,
    className: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
  },
  polling: {
    label: 'Polling',
    icon: <WifiOff className="h-3.5 w-3.5" />,
    className: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
  },
  error: {
    label: 'Error',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: 'border-rose-400/50 bg-rose-500/20 text-rose-200',
  },
};

export function StatusChip({ status }: StatusChipProps) {
  const style = statusStyles[status];

  return (
    <Badge className={cn('gap-1.5 px-3 py-1 text-xs', style.className)} variant="muted">
      {style.icon}
      {style.label}
    </Badge>
  );
}


