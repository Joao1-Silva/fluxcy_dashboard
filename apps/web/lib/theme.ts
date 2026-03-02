export const DASHBOARD_THEME_STORAGE_KEY = 'dashboard.theme';

export const DASHBOARD_THEMES = ['black', 'gray', 'white', 'high-contrast'] as const;

export type DashboardThemeName = (typeof DASHBOARD_THEMES)[number];

export const DASHBOARD_THEME_LABELS: Record<DashboardThemeName, string> = {
  black: 'Black',
  gray: 'Gray',
  white: 'White',
  'high-contrast': 'High Contrast',
};

const LEGACY_THEME_MAP: Record<string, DashboardThemeName> = {
  Default: 'black',
  iOS26: 'gray',
};

const THEME_CHANGE_EVENT = 'dashboard-theme-change';

function isThemeName(value: string): value is DashboardThemeName {
  return DASHBOARD_THEMES.includes(value as DashboardThemeName);
}

export function normalizeTheme(value: unknown): DashboardThemeName | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (isThemeName(value)) {
    return value;
  }

  return LEGACY_THEME_MAP[value] ?? null;
}

export function getStoredTheme(): DashboardThemeName | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
  return normalizeTheme(stored);
}

export function hasStoredThemeSelection(): boolean {
  return getStoredTheme() !== null;
}

export function getSystemTheme(): DashboardThemeName {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'white';
  }

  return 'black';
}

export function getInitialTheme(): DashboardThemeName {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(themeName: DashboardThemeName): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.setAttribute('data-theme', themeName);
  root.style.colorScheme = themeName === 'white' ? 'light' : 'dark';
}

export function setTheme(themeName: DashboardThemeName): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, themeName);
  }

  applyTheme(themeName);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<DashboardThemeName>(THEME_CHANGE_EVENT, { detail: themeName }));
  }
}

export function subscribeThemeChanges(
  callback: (themeName: DashboardThemeName) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const themeName = normalizeTheme((event as CustomEvent<DashboardThemeName>).detail);
    if (themeName) {
      callback(themeName);
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
}

export function subscribeSystemThemeChanges(
  callback: (themeName: DashboardThemeName) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const media = window.matchMedia('(prefers-color-scheme: light)');
  const emit = () => callback(media.matches ? 'white' : 'black');

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', emit);
    return () => media.removeEventListener('change', emit);
  }

  media.addListener(emit);
  return () => media.removeListener(emit);
}
