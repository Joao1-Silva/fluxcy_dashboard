import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumeric } from '@/lib/time';

type KpiCardProps = {
  label: string;
  value: number | null;
  unit?: string;
  subtitle?: string;
  emphasized?: boolean;
};

export function KpiCard({ label, value, unit, subtitle, emphasized = false }: KpiCardProps) {
  return (
    <Card className={emphasized ? 'border-[color:var(--info)] bg-[color:var(--info-bg)]' : ''}>
      <CardHeader className="mb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">{label}</CardTitle>
        <TrendingUp className="h-4 w-4 text-[color:var(--info)]" />
      </CardHeader>
      <CardContent>
        <div className={emphasized ? 'text-3xl font-semibold sm:text-4xl' : 'text-2xl font-semibold sm:text-3xl'}>
          {formatNumeric(value)}
          {unit ? <span className="ml-1 text-sm font-medium text-[color:var(--text-muted)] sm:text-base">{unit}</span> : null}
        </div>
        {subtitle ? <p className="text-xs text-[color:var(--text-muted)]">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}


