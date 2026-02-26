'use client';

import Link from 'next/link';
import { CalendarRange, Pause, Play, Radio, SlidersHorizontal, SquareCheck, LogOut } from 'lucide-react';

import { StatusChip } from '@/components/layout/status-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REFRESH_OPTIONS, RANGE_PRESETS, fromDateTimeLocalInput, toDateTimeLocalInput } from '@/lib/time';
import { useDashboardStore } from '@/store/dashboard-store';
import type { AuthRole } from '@/types/auth';
import type { DataMode } from '@/types/dashboard';

type DashboardHeaderProps = {
  onOpenTasks: () => void;
  canManageTasks: boolean;
  displayName: string;
  role: AuthRole;
  onLogout: () => void;
};

function ModeButton({
  current,
  value,
  onClick,
  label,
}: {
  current: DataMode;
  value: DataMode;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={current === value ? 'default' : 'secondary'}
      size="sm"
      onClick={onClick}
      className="min-w-24"
    >
      {label}
    </Button>
  );
}

export function DashboardHeader({
  onOpenTasks,
  canManageTasks,
  displayName,
  role,
  onLogout,
}: DashboardHeaderProps) {
  const mode = useDashboardStore((state) => state.mode);
  const socketStatus = useDashboardStore((state) => state.socketStatus);
  const fallbackPolling = useDashboardStore((state) => state.fallbackPolling);
  const paused = useDashboardStore((state) => state.paused);
  const refreshMs = useDashboardStore((state) => state.refreshMs);
  const draftRange = useDashboardStore((state) => state.draftRange);
  const presetKey = useDashboardStore((state) => state.presetKey);
  const setMode = useDashboardStore((state) => state.setMode);
  const setPaused = useDashboardStore((state) => state.setPaused);
  const setRefreshMs = useDashboardStore((state) => state.setRefreshMs);
  const setPresetKey = useDashboardStore((state) => state.setPresetKey);
  const setDraftRange = useDashboardStore((state) => state.setDraftRange);
  const applyRange = useDashboardStore((state) => state.applyRange);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const status =
    mode === 'api'
      ? 'polling'
      : socketStatus === 'error'
        ? 'error'
        : socketStatus === 'connected' && !fallbackPolling
          ? 'connected'
          : 'polling';

  const fromInput = toDateTimeLocalInput(draftRange.from);
  const toInput = toDateTimeLocalInput(draftRange.to);

  return (
    <header className="glass-panel mb-5 rounded-2xl p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-wide text-slate-100 lg:text-xl">FLUXCY DEV V1</h1>
          <p className="text-xs text-slate-400">Dashboard BFF / Socket.IO | Timezone: {timezone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="capitalize">
            {displayName} ({role})
          </Badge>
          <StatusChip status={status} />
          {canManageTasks ? (
            <>
              <Button variant="secondary" size="sm" onClick={onOpenTasks}>
                <SquareCheck className="mr-1.5 h-4 w-4" />
                Tasks
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks">Ir a /tasks</Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="flex items-center gap-1.5 text-slate-300">
            <Radio className="h-3.5 w-3.5" />
            Data Mode
          </Label>
          <div className="flex gap-2">
            <ModeButton
              current={mode}
              value="realtime"
              label="Realtime"
              onClick={() => setMode('realtime')}
            />
            <ModeButton current={mode} value="api" label="API" onClick={() => setMode('api')} />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="flex items-center gap-1.5 text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Refresh
          </Label>
          <div className="flex items-center gap-2">
            <select
              className="h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 text-sm text-slate-100"
              value={refreshMs}
              onChange={(event) => setRefreshMs(Number(event.target.value))}
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              variant={paused ? 'outline' : 'secondary'}
              size="icon"
              aria-label={paused ? 'Continuar refresh' : 'Pausar refresh'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="text-slate-300">Preset</Label>
          <select
            className="h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 text-sm text-slate-100"
            value={presetKey}
            onChange={(event) => {
              const value = event.target.value;
              setPresetKey(value);
              const preset = RANGE_PRESETS.find((item) => item.key === value);
              if (preset) {
                setDraftRange(preset.getRange());
              }
            }}
          >
            {RANGE_PRESETS.map((preset) => (
              <option value={preset.key} key={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="flex items-center gap-1.5 text-slate-300">
            <CalendarRange className="h-3.5 w-3.5" />
            From
          </Label>
          <Input
            type="datetime-local"
            value={fromInput}
            onChange={(event) => {
              if (!event.target.value) return;
              setDraftRange({
                ...draftRange,
                from: fromDateTimeLocalInput(event.target.value),
              });
            }}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="text-slate-300">To</Label>
          <Input
            type="datetime-local"
            value={toInput}
            onChange={(event) => {
              if (!event.target.value) return;
              setDraftRange({
                ...draftRange,
                to: fromDateTimeLocalInput(event.target.value),
              });
            }}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="text-slate-300">Apply</Label>
          <Button className="w-full" onClick={applyRange}>
            Aplicar Rango
          </Button>
        </div>
      </div>
    </header>
  );
}
