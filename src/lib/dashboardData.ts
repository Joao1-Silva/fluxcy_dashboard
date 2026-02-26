import dayjs from 'dayjs';
import { env } from '../config/env';
import type {
  DashboardSnapshot,
  DashboardUpdate,
  SeriesPoint,
  SeriesMap,
  TableMap,
} from '../types/dashboard';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeSeriesChunk = (chunk: SeriesPoint | SeriesPoint[]): SeriesPoint[] =>
  Array.isArray(chunk) ? chunk : [chunk];

const mergeSeries = (currentSeries: SeriesMap, incomingSeries?: DashboardUpdate['series']): SeriesMap => {
  if (!incomingSeries) {
    return currentSeries;
  }

  const nextSeries: SeriesMap = { ...currentSeries };

  for (const [key, rawPoints] of Object.entries(incomingSeries)) {
    const current = nextSeries[key] || [];
    const normalized = normalizeSeriesChunk(rawPoints);
    const merged = [...current, ...normalized].slice(-env.maxSeriesPoints);
    nextSeries[key] = merged;
  }

  return nextSeries;
};

export const createEmptySnapshot = (): DashboardSnapshot => ({
  timestamp: new Date().toISOString(),
  metrics: {},
  series: {},
  tables: {},
});

export const mergeSnapshot = (
  current: DashboardSnapshot,
  update: DashboardUpdate,
): DashboardSnapshot => ({
  timestamp: update.timestamp || new Date().toISOString(),
  metrics: {
    ...current.metrics,
    ...(update.metrics || {}),
  },
  series: mergeSeries(current.series, update.series),
  tables: {
    ...current.tables,
    ...(update.tables || {}),
  },
});

const coerceSnapshot = (payload: unknown): DashboardSnapshot | null => {
  if (!isObject(payload)) {
    return null;
  }

  const maybeMetrics = payload.metrics;
  const maybeSeries = payload.series;
  const maybeTables = payload.tables;

  if (!isObject(maybeMetrics) || !isObject(maybeSeries) || !isObject(maybeTables)) {
    return null;
  }

  return {
    timestamp:
      typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString(),
    metrics: maybeMetrics as DashboardSnapshot['metrics'],
    series: maybeSeries as DashboardSnapshot['series'],
    tables: maybeTables as DashboardSnapshot['tables'],
  };
};

export const resolveSnapshotPayload = (payload: unknown): DashboardSnapshot | null => {
  const direct = coerceSnapshot(payload);
  if (direct) {
    return direct;
  }

  if (isObject(payload) && isObject(payload.data)) {
    return coerceSnapshot(payload.data);
  }

  if (isObject(payload) && isObject(payload.snapshot)) {
    return coerceSnapshot(payload.snapshot);
  }

  return null;
};

const buildTimeRange = (count = 40): string[] =>
  Array.from({ length: count }, (_, index) =>
    dayjs()
      .subtract(count - index, 'minute')
      .format('HH:mm'),
  );

const toSeriesRows = (
  labels: string[],
  generator: (index: number) => Record<string, number>,
): SeriesPoint[] => labels.map((time, index) => ({ time, ...generator(index) }));

export const buildDemoSnapshot = (): DashboardSnapshot => {
  const labels = buildTimeRange();

  const tables: TableMap = {
    pressures: [
      {
        fechaHora: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        psiCabezal: 235,
        psiCasing: 235,
        psiLinea: 228,
        psiMacolla: 200,
      },
    ],
  };

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      pcvPos: 100,
      densidadLinea: 0.858,
      gravedadMezcla: 33.3,
      tpLiquido: 210,
      dgFlow: 17.1,
      temperaturaGas: 85,
      tpGas: 207,
      driveGainLiquido: 63.7,
      temperaturaLiquido: 84.1,
      totalLiquido: 37.7,
      deltaP: 3,
      totalGas: 23.1,
    },
    series: {
      flowRate: toSeriesRows(labels, (index) => ({
        gas: 22 + index * 0.02,
        liquido: 17 + index * 0.05,
      })),
      vp: toSeriesRows(labels, (index) => ({
        presionGas: 230 + Math.sin(index / 7) * 6,
        presionLiq: 220 + Math.cos(index / 8) * 5,
        tempGas: 35 + Math.sin(index / 6),
        tempLiq: 32 + Math.cos(index / 5),
      })),
      rho: toSeriesRows(labels, (index) => ({
        densidadGas: 0.62 + index * 0.0006,
        densidadLiq: 0.88 + index * 0.0002,
      })),
      proCalc: toSeriesRows(labels, (index) => ({
        gas: 22,
        liquido: 35 + index * 0.32,
      })),
    },
    tables,
  };
};

export const buildDemoUpdate = (tick: number): DashboardUpdate => {
  const phase = tick / 6;

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      tpLiquido: 210 + Math.sin(phase) * 3,
      dgFlow: 17 + Math.cos(phase) * 1.1,
      tpGas: 207 + Math.cos(phase / 2) * 2.5,
      temperaturaGas: 85 + Math.sin(phase / 3) * 0.9,
      temperaturaLiquido: 84 + Math.cos(phase / 3) * 0.8,
      deltaP: 3 + Math.sin(phase / 4) * 0.3,
      totalLiquido: 37.7 + tick * 0.03,
      totalGas: 23.1 + tick * 0.02,
    },
    series: {
      flowRate: {
        time: dayjs().format('HH:mm'),
        gas: 22 + Math.sin(phase / 2) * 0.7,
        liquido: 17 + Math.cos(phase / 2) * 0.9,
      },
      vp: {
        time: dayjs().format('HH:mm'),
        presionGas: 230 + Math.sin(phase / 2) * 4,
        presionLiq: 220 + Math.cos(phase / 2) * 4,
        tempGas: 35 + Math.sin(phase / 3) * 0.8,
        tempLiq: 32 + Math.cos(phase / 3) * 0.7,
      },
      rho: {
        time: dayjs().format('HH:mm'),
        densidadGas: 0.62 + Math.sin(phase / 4) * 0.005,
        densidadLiq: 0.88 + Math.cos(phase / 4) * 0.004,
      },
      proCalc: {
        time: dayjs().format('HH:mm'),
        gas: 22,
        liquido: 35 + tick * 0.12,
      },
    },
    tables: {
      pressures: [
        {
          fechaHora: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          psiCabezal: Math.round(232 + Math.sin(phase) * 5),
          psiCasing: Math.round(233 + Math.cos(phase) * 5),
          psiLinea: Math.round(228 + Math.sin(phase / 2) * 4),
          psiMacolla: Math.round(201 + Math.cos(phase / 2) * 3),
        },
      ],
    },
  };
};
