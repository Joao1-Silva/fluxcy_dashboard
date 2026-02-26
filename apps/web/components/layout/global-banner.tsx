import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

type GlobalBannerProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function GlobalBanner({ message, actionLabel, onAction }: GlobalBannerProps) {
  return (
    <div className="glass-panel mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm text-amber-100">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <span>{message}</span>
      </div>
      {actionLabel && onAction ? (
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}


