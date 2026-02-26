import dayjs from 'dayjs';
import type { SeriesPoint } from '../types/dashboard';
import type { ChartTimeRange } from '../types/timeRange';

const CLOCK_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const toEpoch = (value: string | number): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : null;
};

const parseClockTime = (value: string, referenceTime: dayjs.Dayjs): number | null => {
  const match = value.match(CLOCK_REGEX);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  let candidate = referenceTime
    .hour(hours)
    .minute(minutes)
    .second(seconds)
    .millisecond(0);

  if (candidate.isAfter(referenceTime.add(1, 'hour'))) {
    candidate = candidate.subtract(1, 'day');
  }

  return candidate.valueOf();
};

const resolvePointEpoch = (
  point: SeriesPoint,
  xKey: string,
  referenceTime: dayjs.Dayjs,
): number | null => {
  const candidates: Array<string | number> = [];

  const directKeys = ['timestamp', 'ts', 'datetime', 'date', xKey];

  for (const key of directKeys) {
    const value = point[key];
    if (typeof value === 'string' || typeof value === 'number') {
      candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const clockValue = parseClockTime(candidate, referenceTime);
      if (clockValue !== null) {
        return clockValue;
      }
    }

    const epoch = toEpoch(candidate);
    if (epoch !== null) {
      return epoch;
    }
  }

  return null;
};

const resolveRangeBounds = (
  range: ChartTimeRange,
  snapshotTimestamp: string,
): { from?: number; to?: number } | null => {
  if (range.mode === 'all') {
    return null;
  }

  const reference = dayjs(snapshotTimestamp);
  const referenceEpoch = reference.isValid() ? reference.valueOf() : Date.now();

  if (range.mode === 'custom') {
    const fromEpoch = range.from ? dayjs(range.from).valueOf() : undefined;
    const toEpoch = range.to ? dayjs(range.to).valueOf() : undefined;

    return {
      from: Number.isFinite(fromEpoch) ? fromEpoch : undefined,
      to: Number.isFinite(toEpoch) ? toEpoch : referenceEpoch,
    };
  }

  const minutesByMode: Record<Exclude<ChartTimeRange['mode'], 'all' | 'custom'>, number> = {
    last_15m: 15,
    last_1h: 60,
    last_6h: 6 * 60,
    last_24h: 24 * 60,
  };

  const windowMinutes = minutesByMode[range.mode as Exclude<ChartTimeRange['mode'], 'all' | 'custom'>];

  return {
    from: referenceEpoch - windowMinutes * 60 * 1000,
    to: referenceEpoch,
  };
};

export const filterSeriesByTimeRange = (
  rows: SeriesPoint[],
  xKey: string,
  range: ChartTimeRange,
  snapshotTimestamp: string,
): SeriesPoint[] => {
  if (!rows.length) {
    return rows;
  }

  const bounds = resolveRangeBounds(range, snapshotTimestamp);
  if (!bounds) {
    return rows;
  }

  const reference = dayjs(snapshotTimestamp);
  const safeReference = reference.isValid() ? reference : dayjs();

  return rows.filter((row) => {
    const pointEpoch = resolvePointEpoch(row, xKey, safeReference);

    if (pointEpoch === null) {
      return true;
    }

    if (bounds.from !== undefined && pointEpoch < bounds.from) {
      return false;
    }

    if (bounds.to !== undefined && pointEpoch > bounds.to) {
      return false;
    }

    return true;
  });
};
