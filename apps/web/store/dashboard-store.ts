'use client';

import { subHours } from 'date-fns';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { normalizeTheme } from '@/lib/theme';
import { buildRange, RANGE_PRESETS } from '@/lib/time';
import type { ApiProfile } from '@/types/api-profile';
import type { DashboardThemeMode, DataMode, SocketStatus, TimeRange } from '@/types/dashboard';

type DashboardState = {
  mode: DataMode;
  themeMode: DashboardThemeMode;
  socketStatus: SocketStatus;
  fallbackPolling: boolean;
  canResumeRealtime: boolean;
  paused: boolean;
  refreshMs: number;
  presetKey: string;
  draftRange: TimeRange;
  appliedRange: TimeRange;
  rangeVersion: number;
  banner: string | null;
  apiProfileOverride: ApiProfile;
  setMode: (mode: DataMode) => void;
  setThemeMode: (themeMode: DashboardThemeMode) => void;
  setSocketStatus: (status: SocketStatus) => void;
  enableFallbackPolling: (message: string) => void;
  resumeRealtime: () => void;
  setPaused: (paused: boolean) => void;
  setRefreshMs: (refreshMs: number) => void;
  setPresetKey: (presetKey: string) => void;
  applyPreset: (presetKey: string) => void;
  setDraftRange: (range: TimeRange) => void;
  applyRange: () => void;
  setBanner: (message: string | null) => void;
  setApiProfileOverride: (profile: ApiProfile) => void;
};

const initialRange = buildRange(subHours(new Date(), 1), new Date());

const defaultState = {
  mode: 'realtime' as DataMode,
  themeMode: 'black' as DashboardThemeMode,
  socketStatus: 'disconnected' as SocketStatus,
  fallbackPolling: false,
  canResumeRealtime: false,
  paused: false,
  refreshMs: 30_000,
  presetKey: '1h',
  draftRange: initialRange,
  appliedRange: initialRange,
  rangeVersion: 0,
  banner: null,
  apiProfileOverride: 'DEFAULT' as ApiProfile,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      setMode: (mode) => {
        set({
          mode,
          fallbackPolling: false,
          canResumeRealtime: false,
          banner: null,
        });
      },
      setThemeMode: (themeMode) => set({ themeMode }),
      setSocketStatus: (status) => {
        const state = get();
        const next = {
          socketStatus: status,
          canResumeRealtime:
            status === 'connected' && state.mode === 'realtime' && state.fallbackPolling,
        };

        set(next);
      },
      enableFallbackPolling: (message) => {
        set({
          fallbackPolling: true,
          banner: message,
        });
      },
      resumeRealtime: () => {
        set({
          fallbackPolling: false,
          canResumeRealtime: false,
          banner: null,
        });
      },
      setPaused: (paused) => set({ paused }),
      setRefreshMs: (refreshMs) => set({ refreshMs }),
      setPresetKey: (presetKey) => set({ presetKey }),
      applyPreset: (presetKey) => {
        const preset = RANGE_PRESETS.find((item) => item.key === presetKey);
        if (!preset) {
          return;
        }

        const range = preset.getRange();
        set((state) => ({
          presetKey,
          draftRange: range,
          appliedRange: range,
          rangeVersion: state.rangeVersion + 1,
        }));
      },
      setDraftRange: (range) => set({ draftRange: range }),
      applyRange: () => {
        const { draftRange } = get();
        set((state) => ({
          appliedRange: draftRange,
          rangeVersion: state.rangeVersion + 1,
        }));
      },
      setBanner: (banner) => set({ banner }),
      setApiProfileOverride: (apiProfileOverride) => set({ apiProfileOverride }),
    }),
    {
      name: 'fluxcy-dashboard-store',
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<DashboardState> & {
          themeMode?: unknown;
        };

        return {
          ...state,
          themeMode: normalizeTheme(state.themeMode) ?? defaultState.themeMode,
        } as DashboardState;
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<DashboardState>),
        themeMode: currentState.themeMode,
      }),
      partialize: (state) => ({
        mode: state.mode,
        paused: state.paused,
        refreshMs: state.refreshMs,
        presetKey: state.presetKey,
        apiProfileOverride: state.apiProfileOverride,
      }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);


