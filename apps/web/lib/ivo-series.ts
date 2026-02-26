import type { SeriesPoint } from '@/types/dashboard';

type IvoRange = {
  ivoFrom: number;
  ivoTo: number;
};

const IVO_VALUE_KEYS = ['vliq', 'totalliq', 'liq_acum'] as const;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function pickIvoValue(point: SeriesPoint): number | null {
  for (const key of IVO_VALUE_KEYS) {
    const value = toNumber(point[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function byTimeAsc(a: SeriesPoint, b: SeriesPoint) {
  return a.t.localeCompare(b.t);
}

export function extractIvoRange(series: SeriesPoint[]): IvoRange | null {
  if (series.length === 0) {
    return null;
  }

  const sorted = [...series].sort(byTimeAsc);

  let ivoFrom: number | null = null;
  let ivoTo: number | null = null;

  for (const point of sorted) {
    const value = pickIvoValue(point);
    if (value !== null) {
      ivoFrom = value;
      break;
    }
  }

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const value = pickIvoValue(sorted[index]);
    if (value !== null) {
      ivoTo = value;
      break;
    }
  }

  if (ivoFrom === null || ivoTo === null) {
    return null;
  }

  return { ivoFrom, ivoTo };
}
