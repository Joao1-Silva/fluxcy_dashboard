'use client';

import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimeLabel } from '@/lib/time';
import type { SeriesPoint } from '@/types/dashboard';

type SeriesLine = {
  key: string;
  label: string;
  color: string;
};

type TimeSeriesPanelProps = {
  title: string;
  subtitle?: string;
  data: SeriesPoint[];
  lines: SeriesLine[];
  loading?: boolean;
  rightActions?: ReactNode;
};

export function TimeSeriesPanel({
  title,
  subtitle,
  data,
  lines,
  loading = false,
  rightActions,
}: TimeSeriesPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {rightActions}
      </CardHeader>
      <CardContent className="h-[290px]">
        {loading ? (
          <Skeleton className="h-full w-full rounded-2xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 6 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                tickFormatter={formatTimeLabel}
                tick={{ fill: '#94A3B8', fontSize: 11 }}
                minTickGap={14}
              />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} width={44} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid rgba(56,189,248,0.35)',
                  background: 'rgba(2,6,23,0.9)',
                }}
                labelFormatter={(value) => formatTimeLabel(String(value))}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {lines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  name={line.label}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}


