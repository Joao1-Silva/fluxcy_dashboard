'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchJson, querySignal } from '@/lib/api-client';
import { useDashboardStore } from '@/store/dashboard-store';
import type { AssistantAnalyzeResponse } from '@/types/assistant';

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '--';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function confidenceVariant(confidence: number): 'success' | 'warning' | 'danger' {
  if (confidence >= 0.8) {
    return 'success';
  }
  if (confidence >= 0.6) {
    return 'warning';
  }
  return 'danger';
}

function confidencePercent(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function AssistantAgentDialog() {
  const [open, setOpen] = useState(false);

  const appliedRange = useDashboardStore((state) => state.appliedRange);
  const rangeVersion = useDashboardStore((state) => state.rangeVersion);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const query = useQuery({
    queryKey: ['assistant', 'analyze', appliedRange.from, appliedRange.to, timezone, rangeVersion],
    enabled: open,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    queryFn: (ctx) =>
      fetchJson<AssistantAnalyzeResponse>('/api/assistant/analyze', {
        signal: querySignal(ctx),
        method: 'POST',
        body: {
          from: appliedRange.from,
          to: appliedRange.to,
          timezone,
        },
      }),
  });

  const errorMessage = query.error instanceof Error ? query.error.message : null;
  const data = query.data;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <Bot className="mr-1.5 h-4 w-4" />
          Asistente IA
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full max-w-2xl overflow-hidden">
        <SheetHeader>
          <SheetTitle>Analisis del Agente</SheetTitle>
          <SheetDescription>
            Rango aplicado: {formatTimestamp(appliedRange.from)} - {formatTimestamp(appliedRange.to)}
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="muted">Timezone: {timezone}</Badge>
          {data ? <Badge variant={confidenceVariant(data.confidence)}>Confianza: {confidencePercent(data.confidence)}</Badge> : null}
          {typeof data?.meta?.elapsedMs === 'number' ? <Badge variant="muted">Tiempo: {data.meta.elapsedMs} ms</Badge> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
            Reanalizar
          </Button>
        </div>

        <div className="max-h-[calc(100vh-190px)] space-y-4 overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : null}

          {!query.isLoading && errorMessage ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          {data ? (
            <>
              <section className="rounded-xl border border-sky-400/30 bg-slate-900/70 p-3">
                <h3 className="mb-1 text-sm font-semibold text-slate-100">Resumen</h3>
                <p className="text-sm text-slate-300">{data.summary}</p>
                {data.meta?.generatedAt ? (
                  <p className="mt-2 text-xs text-slate-400">Generado: {formatTimestamp(data.meta.generatedAt)}</p>
                ) : null}
              </section>

              <section className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  Recomendaciones ({data.recommendations.length})
                </h3>
                {data.recommendations.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin recomendaciones para este rango.</p>
                ) : (
                  <div className="space-y-3">
                    {data.recommendations.map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-2.5">
                        <p className="text-sm font-medium text-slate-100">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-400">Evidencias: {item.evidence.map((e) => e.id).join(', ') || '--'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Eventos de Regimen ({data.events.length})</h3>
                {data.events.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin cambios de regimen detectados.</p>
                ) : (
                  <div className="space-y-2">
                    {data.events.slice(0, 10).map((event) => (
                      <div key={event.id} className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-2.5 text-xs text-slate-300">
                        <p>
                          {formatTimestamp(event.start)} - {formatTimestamp(event.end)}
                        </p>
                        <p className="text-slate-400">
                          Variables: {event.variablesChanged.map((entry) => entry.metric).join(', ') || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Anomalias ({data.anomalies.length})</h3>
                {data.anomalies.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin anomalias multivariadas en el rango.</p>
                ) : (
                  <div className="space-y-2">
                    {data.anomalies.slice(0, 10).map((anomaly) => (
                      <div key={anomaly.id} className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-2.5 text-xs text-slate-300">
                        <p>
                          {formatTimestamp(anomaly.start)} - {formatTimestamp(anomaly.end)}
                        </p>
                        <p className="text-slate-400">
                          Score {anomaly.score.toFixed(2)} | Drivers: {anomaly.drivers.map((driver) => driver.metric).join(', ') || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Correlaciones ({data.correlations.length})</h3>
                {data.correlations.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin correlaciones lead/lag significativas.</p>
                ) : (
                  <div className="space-y-2">
                    {data.correlations.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-2.5 text-xs text-slate-300">
                        <p>{item.pair}</p>
                        <p className="text-slate-400">
                          lag {item.lagMinutes} min | fuerza {item.strength.toFixed(2)} | {item.relationship}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
