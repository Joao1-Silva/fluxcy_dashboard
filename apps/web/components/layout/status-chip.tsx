import type { ReactNode } from 'react';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusChipProps = {
  status: 'connected' | 'polling' | 'error';
};

const statusStyles: Record<
  StatusChipProps['status'],
  {
    label: string;
    icon: ReactNode;
    className: string;
    variant: 'success' | 'warning' | 'danger';
  }
> = {
  connected: {
    label: 'Connected',
    icon: <Wifi className="h-3.5 w-3.5" />,
    className: 'status-chip--connected',
    variant: 'success',
  },
  polling: {
    label: 'Polling',
    icon: <WifiOff className="h-3.5 w-3.5" />,
    className: 'status-chip--polling',
    variant: 'warning',
  },
  error: {
    label: 'Error',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: 'status-chip--error',
    variant: 'danger',
  },
};

export function StatusChip({ status }: StatusChipProps) {
  const style = statusStyles[status];

  return (
    <Badge className={cn('status-chip gap-1.5 px-3 py-1 text-xs font-semibold', style.className)} variant={style.variant}>
      {style.icon}
      {style.label}
    </Badge>
  );
}


