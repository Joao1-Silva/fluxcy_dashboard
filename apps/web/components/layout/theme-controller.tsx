'use client';

import { useEffect } from 'react';

import {
  applyTheme,
  getInitialTheme,
  hasStoredThemeSelection,
  subscribeSystemThemeChanges,
  subscribeThemeChanges,
} from '@/lib/theme';
import { useDashboardStore } from '@/store/dashboard-store';

export function ThemeController() {
  const themeMode = useDashboardStore((state) => state.themeMode);
  const setThemeMode = useDashboardStore((state) => state.setThemeMode);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setThemeMode(initialTheme);
    applyTheme(initialTheme);
  }, [setThemeMode]);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => subscribeThemeChanges(setThemeMode), [setThemeMode]);

  useEffect(
    () =>
      subscribeSystemThemeChanges((systemTheme) => {
        if (!hasStoredThemeSelection()) {
          setThemeMode(systemTheme);
        }
      }),
    [setThemeMode],
  );

  return null;
}
