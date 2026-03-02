import { Gauge } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumeric } from '@/lib/time';

type GaugeCardProps = {
  label: string;
  min: number;
  max: number;
  value: number | null;
  unit?: string;
};

export function GaugeCard({ label, min, max, value, unit }: GaugeCardProps) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const circumference = 2 * Math.PI * 42;
  const dash = circumference * normalized;

  return (
    <Card>
      <CardHeader className="mb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">{label}</CardTitle>
        <Gauge className="h-4 w-4 text-[color:var(--info)]" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(var(--border-rgb),0.45)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-[color:var(--text)] sm:text-3xl">
            {formatNumeric(value)}{' '}
            {unit ? <span className="text-sm text-[color:var(--text-muted)] sm:text-base">{unit}</span> : null}
          </div>
          <p className="text-xs text-[color:var(--text-muted)]">
            Range: {min} - {max}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


