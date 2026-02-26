import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumeric } from '@/lib/time';

type DualKpiCardProps = {
  title: string;
  leftLabel: string;
  leftValue: number | null;
  rightLabel: string;
  rightValue: number | null;
  unit?: string;
};

export function DualKpiCard({
  title,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  unit,
}: DualKpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-wide text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-400">{leftLabel}</p>
          <p className="text-2xl font-semibold text-slate-100">
            {formatNumeric(leftValue)}
            {unit ? <span className="ml-1 text-sm text-slate-400">{unit}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{rightLabel}</p>
          <p className="text-2xl font-semibold text-slate-100">
            {formatNumeric(rightValue)}
            {unit ? <span className="ml-1 text-sm text-slate-400">{unit}</span> : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


