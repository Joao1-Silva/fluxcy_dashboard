'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Expand, Minimize2 } from 'lucide-react';
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

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [nativeExpanded, setNativeExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const isExpanded = fallbackExpanded || nativeExpanded;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 640px)');
    const setCompact = () => setIsCompact(media.matches);

    setCompact();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', setCompact);
      return () => media.removeEventListener('change', setCompact);
    }

    media.addListener(setCompact);
    return () => media.removeListener(setCompact);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const onFullscreenChange = () => {
      const expanded = document.fullscreenElement === panelRef.current;
      setNativeExpanded(expanded);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!fallbackExpanded || typeof window === 'undefined') {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFallbackExpanded(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fallbackExpanded]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (fallbackExpanded) {
      document.body.classList.add('panel-overlay-open');
    } else {
      document.body.classList.remove('panel-overlay-open');
    }

    return () => document.body.classList.remove('panel-overlay-open');
  }, [fallbackExpanded]);

  const chartHeightClass = useMemo(() => {
    if (isExpanded) {
      return 'h-[calc(100dvh-180px)] min-h-[320px]';
    }
    return 'h-[240px] sm:h-[290px]';
  }, [isExpanded]);

  const toggleExpand = async () => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (isExpanded) {
      setFallbackExpanded(false);
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      }
      return;
    }

    try {
      if (typeof panel.requestFullscreen === 'function') {
        await panel.requestFullscreen();
        return;
      }
    } catch {
      setFallbackExpanded(true);
      return;
    }

    setFallbackExpanded(true);
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        'chart-panel relative',
        fallbackExpanded ? 'fixed inset-0 z-[70] overflow-y-auto bg-slate-950/95 p-2 sm:p-4' : '',
      )}
    >
      <Card className={cn('h-full overflow-hidden', isExpanded ? 'mx-auto max-w-[1880px]' : '')}>
        <CardHeader className="mb-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{title}</CardTitle>
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {rightActions}
            <Button
              type="button"
              variant={isExpanded ? 'outline' : 'secondary'}
              size="sm"
              onClick={toggleExpand}
              aria-label={isExpanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isExpanded ? <Minimize2 className="mr-1 h-4 w-4" /> : <Expand className="mr-1 h-4 w-4" />}
              {isExpanded ? 'Salir' : 'Expandir'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className={chartHeightClass}>
          {loading ? (
            <Skeleton className="h-full w-full rounded-2xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: isCompact ? 6 : 12, left: 0, bottom: isCompact ? 2 : 6 }}
              >
                <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickFormatter={formatTimeLabel}
                  tick={{ fill: '#94A3B8', fontSize: isCompact ? 10 : 11 }}
                  minTickGap={isCompact ? 28 : 14}
                />
                <YAxis tick={{ fill: '#94A3B8', fontSize: isCompact ? 10 : 11 }} width={isCompact ? 36 : 44} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid rgba(56,189,248,0.35)',
                    background: 'rgba(2,6,23,0.9)',
                  }}
                  labelFormatter={(value) => formatTimeLabel(String(value))}
                />
                {!isCompact ? <Legend wrapperStyle={{ fontSize: '12px' }} /> : null}
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
    </div>
  );
}


