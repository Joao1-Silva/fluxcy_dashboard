import type { MetricValue } from '../types/dashboard';

export const safeNumber = (value: MetricValue): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const formatMetric = (
  value: MetricValue,
  options?: {
    decimals?: number;
    unit?: string;
    prefix?: string;
    suffix?: string;
  },
): string => {
  const { decimals = 0, unit, prefix, suffix } = options || {};

  if (value === null || value === undefined || value === '') {
    return 'No data';
  }

  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric.toFixed(decimals) : String(value);

  return `${prefix || ''}${base}${unit ? ` ${unit}` : ''}${suffix || ''}`.trim();
};
