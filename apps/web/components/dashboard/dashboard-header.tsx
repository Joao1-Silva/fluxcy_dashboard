'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  FileSpreadsheet,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Palette,
  Pause,
  Play,
  Radio,
  SlidersHorizontal,
  SquareCheck,
} from 'lucide-react';

import { StatusChip } from '@/components/layout/status-chip';
import { AssistantAgentDialog } from '@/components/dashboard/assistant-agent-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getApiProfileOverrideFromBrowser,
  setApiProfileOverrideInBrowser,
} from '@/lib/api-profile';
import { REFRESH_OPTIONS, RANGE_PRESETS, fromDateTimeLocalInput, toDateTimeLocalInput } from '@/lib/time';
import { useDashboardStore } from '@/store/dashboard-store';
import type { AuthRole } from '@/types/auth';

type DashboardHeaderProps = {
  onOpenTasks: () => void;
  canManageTasks: boolean;
  displayName: string;
  role: AuthRole;
  onLogout: () => void | Promise<void>;
  moduleVariant?: 'default' | 'health';
};

function ToggleButton({
  current,
  value,
  onClick,
  label,
}: {
  current: string;
  value: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={current === value ? 'default' : 'secondary'}
      size="sm"
      onClick={onClick}
      className="min-w-[5.25rem] flex-1 sm:flex-none"
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
  moduleVariant = 'default',
}: DashboardHeaderProps) {
  const mode = useDashboardStore((state) => state.mode);
  const themeMode = useDashboardStore((state) => state.themeMode);
  const socketStatus = useDashboardStore((state) => state.socketStatus);
  const fallbackPolling = useDashboardStore((state) => state.fallbackPolling);
  const paused = useDashboardStore((state) => state.paused);
  const refreshMs = useDashboardStore((state) => state.refreshMs);
  const draftRange = useDashboardStore((state) => state.draftRange);
  const presetKey = useDashboardStore((state) => state.presetKey);
  const setMode = useDashboardStore((state) => state.setMode);
  const setThemeMode = useDashboardStore((state) => state.setThemeMode);
  const setPaused = useDashboardStore((state) => state.setPaused);
  const setRefreshMs = useDashboardStore((state) => state.setRefreshMs);
  const setPresetKey = useDashboardStore((state) => state.setPresetKey);
  const setDraftRange = useDashboardStore((state) => state.setDraftRange);
  const applyRange = useDashboardStore((state) => state.applyRange);
  const apiProfileOverride = useDashboardStore((state) => state.apiProfileOverride);
  const setApiProfileOverride = useDashboardStore((state) => state.setApiProfileOverride);

  useEffect(() => {
    if (role === 'superadmin') {
      setApiProfileOverride(getApiProfileOverrideFromBrowser());
      return;
    }

    setApiProfileOverride('DEFAULT');
  }, [role, setApiProfileOverride]);

  useEffect(() => {
    if (role !== 'superadmin') {
      return;
    }

    setApiProfileOverrideInBrowser(apiProfileOverride);
  }, [apiProfileOverride, role]);

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
    <header className="glass-panel mb-5 rounded-2xl p-3 sm:p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-wide text-slate-100 lg:text-xl">FLUXCY DEV V1</h1>
          <p className="text-xs text-slate-400 sm:text-sm">
            Dashboard BFF / Socket.IO | Timezone: {timezone} | Theme: {themeMode}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Badge variant="muted" className="capitalize">
            {displayName} ({role})
          </Badge>
          <StatusChip status={status} />
          <Button variant={moduleVariant === 'default' ? 'default' : 'secondary'} size="sm" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="mr-1.5 h-4 w-4" />
              Default
            </Link>
          </Button>
          <Button variant={moduleVariant === 'health' ? 'default' : 'secondary'} size="sm" asChild>
            <Link href="/dashboard/health">
              <HeartPulse className="mr-1.5 h-4 w-4" />
              Health
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/reports/corrida">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Reportes
            </Link>
          </Button>
          {canManageTasks ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950/55 px-2 py-1.5">
                <Label className="text-xs text-slate-300">Fuente</Label>
                <select
                  className="h-8 rounded-lg border border-slate-700/70 bg-slate-900/85 px-2 text-xs text-slate-100"
                  value={apiProfileOverride}
                  onChange={(event) =>
                    setApiProfileOverride(event.target.value === 'WELLTECH' ? 'WELLTECH' : 'DEFAULT')
                  }
                >
                  <option value="DEFAULT">Principal (Sermaca)</option>
                  <option value="WELLTECH">WellTech (equipo 2)</option>
                </select>
              </div>
              <Button variant="secondary" size="sm" onClick={onOpenTasks}>
                <SquareCheck className="mr-1.5 h-4 w-4" />
                Tasks
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/tasks">Ir a /tasks</Link>
              </Button>
            </>
          ) : null}
          <AssistantAgentDialog />
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-3 xl:col-span-1">
          <Label className="flex items-center gap-1.5 text-slate-300">
            <Radio className="h-3.5 w-3.5" />
            Data Mode
          </Label>
          <div className="flex flex-wrap gap-2">
            <ToggleButton
              current={mode}
              value="realtime"
              label="Realtime"
              onClick={() => setMode('realtime')}
            />
            <ToggleButton current={mode} value="api" label="API" onClick={() => setMode('api')} />
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
          <Label className="flex items-center gap-1.5 text-slate-300">
            <Palette className="h-3.5 w-3.5" />
            Theme
          </Label>
          <div className="flex flex-wrap gap-2">
            <ToggleButton
              current={themeMode}
              value="Default"
              label="Default"
              onClick={() => setThemeMode('Default')}
            />
            <ToggleButton
              current={themeMode}
              value="iOS26"
              label="iOS26"
              onClick={() => setThemeMode('iOS26')}
            />
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
