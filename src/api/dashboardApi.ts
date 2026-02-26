import dayjs from 'dayjs';
import { env } from '../config/env';
import { apiRequest } from '../lib/apiClient';
import { buildDemoSnapshot } from '../lib/dashboardData';
import type { DashboardSnapshot, DashboardUpdate, SeriesPoint } from '../types/dashboard';
import type { ChartTimeRange } from '../types/timeRange';

interface RealtimeEvents {
  connected?: string;
  subscribe?: string;
  unsubscribe?: string;
  stream_all?: string;
  stream_pozo?: string;
}

export interface RealtimeSocketConfig {
  origin?: string;
  path?: string;
  url?: string;
  transports?: string[];
  events?: RealtimeEvents;
}

export interface RealtimeLatestMeasurement {
  timestamp_hmi?: string;
  pozo?: string | null;
  qm_liq?: number | null;
  qm_gas?: number | null;
  total_liq?: number | null;
  total_gas?: number | null;
  densidad_liq?: number | null;
  densidad_gas?: number | null;
  temp_liq?: number | null;
  temp_gas?: number | null;
  pres_f_liq?: number | null;
  pres_f_gas?: number | null;
  bsw_lab?: number | null;
  presion_cabezal?: number | null;
  presion_casing?: number | null;
  presion_linea?: number | null;
  presion_macolla?: number | null;
  inv_liq?: number | null;
  inv_gas?: number | null;
  diluente?: number | null;
}

export interface RealtimeBootstrapPayload {
  status?: string;
  server_time?: string;
  socket?: RealtimeSocketConfig;
  latest?: RealtimeLatestMeasurement | null;
  latest_error?: string | null;
}

interface RealtimeSeriesResponse {
  series?: Array<Record<string, number | string | null>>;
}

interface RealtimeDataResponse {
  data?: Array<Record<string, number | string | null>>;
}

interface SnapshotRequestParams {
  token: string;
  timeRange: ChartTimeRange;
}

export interface DashboardFetchResult {
  snapshot: DashboardSnapshot;
  bootstrap: RealtimeBootstrapPayload | null;
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toEpoch = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.valueOf() : null;
  }

  return null;
};

const formatDateTime = (value: unknown): string => {
  const epoch = toEpoch(value);
  if (epoch === null) {
    return dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  return dayjs(epoch).format('YYYY-MM-DD HH:mm:ss');
};

const appendQuery = (
  path: string,
  params: Record<string, string | undefined>,
): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  }

  const query = search.toString();
  if (!query) {
    return path;
  }

  return `${path}?${query}`;
};

const resolveTimeBounds = (
  range: ChartTimeRange,
  referenceTimestamp?: string,
): { from?: string; to?: string } => {
  const reference = referenceTimestamp ? dayjs(referenceTimestamp) : null;
  const now = reference && reference.isValid() ? reference : dayjs();

  switch (range.mode) {
    case 'all':
      return {};

    case 'last_15m':
      return {
        from: now.subtract(15, 'minute').toISOString(),
        to: now.toISOString(),
      };

    case 'last_1h':
      return {
        from: now.subtract(1, 'hour').toISOString(),
        to: now.toISOString(),
      };

    case 'last_6h':
      return {
        from: now.subtract(6, 'hour').toISOString(),
        to: now.toISOString(),
      };

    case 'last_24h':
      return {
        from: now.subtract(24, 'hour').toISOString(),
        to: now.toISOString(),
      };

    case 'custom': {
      const parsedFrom = range.from ? dayjs(range.from) : null;
      const parsedTo = range.to ? dayjs(range.to) : null;

      return {
        from: parsedFrom && parsedFrom.isValid()
          ? parsedFrom.toISOString()
          : now.subtract(6, 'hour').toISOString(),
        to: parsedTo && parsedTo.isValid() ? parsedTo.toISOString() : now.toISOString(),
      };
    }

    default:
      return {
        from: now.subtract(6, 'hour').toISOString(),
        to: now.toISOString(),
      };
  }
};

const normalizeRows = (value: unknown): Array<Record<string, number | string | null>> => {
  return Array.isArray(value) ? (value as Array<Record<string, number | string | null>>) : [];
};

const safeFulfilled = <T>(
  result: PromiseSettledResult<T>,
): T | null => (result.status === 'fulfilled' ? result.value : null);

const pointTime = (row: Record<string, number | string | null>): number | string => {
  const raw = row.time ?? row.timestamp_hmi ?? row.fecha_creacion_iso ?? row.timestamp_short;
  const epoch = toEpoch(raw);
  return epoch ?? String(raw ?? '');
};

const mapFlowRateSeries = (rows: Array<Record<string, number | string | null>>): SeriesPoint[] => {
  return rows.map((row) => ({
    time: pointTime(row),
    gas: toNumber(row.qm_gas),
    liquido: toNumber(row.qm_liq),
  }));
};

const mapVpSeries = (rows: Array<Record<string, number | string | null>>): SeriesPoint[] => {
  return rows.map((row) => ({
    time: pointTime(row),
    presionGas: toNumber(row.psi_gas ?? row.pres_f_gas),
    presionLiq: toNumber(row.psi_liq ?? row.pres_f_liq),
    tempGas: toNumber(row.temp_gas),
    tempLiq: toNumber(row.temp_liq),
  }));
};

const mapRhoSeries = (rows: Array<Record<string, number | string | null>>): SeriesPoint[] => {
  return rows.map((row) => ({
    time: pointTime(row),
    densidadGas: toNumber(row.rho_gas ?? row.densidad_gas),
    densidadLiq: toNumber(row.rho_liq ?? row.densidad_liq),
  }));
};

const mapProduccionSeries = (
  rows: Array<Record<string, number | string | null>>,
): SeriesPoint[] => {
  return rows.map((row) => ({
    time: pointTime(row),
    gas: toNumber(row.gas_acum ?? row.prod_gas_h ?? row.total_gas),
    liquido: toNumber(row.liq_acum ?? row.prod_liq_h ?? row.total_liq),
  }));
};

const mapLatestToMetrics = (
  latest: RealtimeLatestMeasurement | null | undefined,
): DashboardSnapshot['metrics'] => {
  if (!latest) {
    return {};
  }

  const tpLiquido = toNumber(latest.pres_f_liq);
  const tpGas = toNumber(latest.pres_f_gas);

  return {
    tpLiquido,
    tpGas,
    temperaturaGas: toNumber(latest.temp_gas),
    temperaturaLiquido: toNumber(latest.temp_liq),
    totalLiquido: toNumber(latest.total_liq),
    totalGas: toNumber(latest.total_gas),
    densidadLinea: toNumber(latest.densidad_liq),
    deltaP:
      tpLiquido !== null && tpGas !== null
        ? Number((tpLiquido - tpGas).toFixed(2))
        : null,
  };
};

export const buildRealtimeUpdateFromLatest = (
  latest: RealtimeLatestMeasurement,
): DashboardUpdate => {
  const timestamp = latest.timestamp_hmi || new Date().toISOString();
  const time = toEpoch(timestamp) || Date.now();

  const baseMetrics = mapLatestToMetrics(latest);

  return {
    timestamp,
    metrics: {
      ...baseMetrics,
      flowQmGas: toNumber(latest.qm_gas),
      flowQmLiquido: toNumber(latest.qm_liq),
    },
    series: {
      flowRate: {
        time,
        gas: toNumber(latest.qm_gas),
        liquido: toNumber(latest.qm_liq),
      },
      vp: {
        time,
        presionGas: toNumber(latest.pres_f_gas),
        presionLiq: toNumber(latest.pres_f_liq),
        tempGas: toNumber(latest.temp_gas),
        tempLiq: toNumber(latest.temp_liq),
      },
      rho: {
        time,
        densidadGas: toNumber(latest.densidad_gas),
        densidadLiq: toNumber(latest.densidad_liq),
      },
      proCalc: {
        time,
        gas: toNumber(latest.total_gas),
        liquido: toNumber(latest.total_liq),
      },
    },
    tables: {
      pressures: [
        {
          fechaHora: formatDateTime(latest.timestamp_hmi),
          psiCabezal: toNumber(latest.presion_cabezal),
          psiCasing: toNumber(latest.presion_casing),
          psiLinea: toNumber(latest.presion_linea),
          psiMacolla: toNumber(latest.presion_macolla),
        },
      ],
    },
  };
};

export const fetchDashboardSnapshot = async ({
  token,
  timeRange,
}: SnapshotRequestParams): Promise<DashboardFetchResult> => {
  if (env.enableDemoMode) {
    return {
      snapshot: buildDemoSnapshot(),
      bootstrap: null,
    };
  }

  let bootstrap: RealtimeBootstrapPayload | null = null;

  try {
    bootstrap = await apiRequest<RealtimeBootstrapPayload>(env.realtimeBootstrapPath, {
      method: 'GET',
      token,
    });
  } catch {
    bootstrap = null;
  }

  const { from, to } = resolveTimeBounds(
    timeRange,
    bootstrap?.latest?.timestamp_hmi || bootstrap?.server_time,
  );
  const timeParams = { from, to };

  const requests = await Promise.allSettled([
    apiRequest<RealtimeSeriesResponse>(appendQuery(env.realtimeQmrPath, timeParams), {
      method: 'GET',
      token,
    }),
    apiRequest<RealtimeSeriesResponse>(appendQuery(env.realtimeVpPath, timeParams), {
      method: 'GET',
      token,
    }),
    apiRequest<RealtimeSeriesResponse>(appendQuery(env.realtimeRhoPath, timeParams), {
      method: 'GET',
      token,
    }),
    apiRequest<RealtimeSeriesResponse>(appendQuery(env.realtimeProduccionPath, timeParams), {
      method: 'GET',
      token,
    }),
    apiRequest<RealtimeDataResponse>(env.realtimePressuresPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimeTotalPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimeRholiqPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimeDensidadApiPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimeTempPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimeDrivgainPath, { method: 'GET', token }),
    apiRequest<RealtimeDataResponse>(env.realtimePossValvePath, { method: 'GET', token }),
  ]);

  const qmr = safeFulfilled(requests[0]);
  const vp = safeFulfilled(requests[1]);
  const rho = safeFulfilled(requests[2]);
  const produccion = safeFulfilled(requests[3]);
  const pressures = safeFulfilled(requests[4]);
  const total = safeFulfilled(requests[5]);
  const rholiq = safeFulfilled(requests[6]);
  const densidadApi = safeFulfilled(requests[7]);
  const temp = safeFulfilled(requests[8]);
  const drivgain = safeFulfilled(requests[9]);
  const possValve = safeFulfilled(requests[10]);

  const latest = bootstrap?.latest;

  const latestMetrics = mapLatestToMetrics(latest);
  const totalRow = normalizeRows(total?.data)[0] || {};
  const rholiqRow = normalizeRows(rholiq?.data)[0] || {};
  const densidadApiRow = normalizeRows(densidadApi?.data)[0] || {};
  const tempRow = normalizeRows(temp?.data)[0] || {};
  const drivgainRow = normalizeRows(drivgain?.data)[0] || {};
  const possValveRow = normalizeRows(possValve?.data)[0] || {};
  const pressureRow = normalizeRows(pressures?.data)[0] || {};

  const psiLiq = toNumber(rholiqRow.psi_liq ?? latest?.pres_f_liq);
  const psiGas = toNumber(rholiqRow.psi_gas ?? latest?.pres_f_gas);

  const metrics = {
    ...latestMetrics,
    pcvPos: toNumber(possValveRow.posicion_valvula),
    densidadLinea: toNumber(rholiqRow.densidad ?? latest?.densidad_liq),
    gravedadMezcla: toNumber(densidadApiRow.api),
    tpLiquido: psiLiq,
    dgFlow: toNumber(drivgainRow.drive_gain_gas),
    temperaturaGas: toNumber(tempRow.temp_gas ?? latest?.temp_gas),
    tpGas: psiGas,
    driveGainLiquido: toNumber(drivgainRow.drive_gain_liquido),
    temperaturaLiquido: toNumber(tempRow.temp_liquido ?? latest?.temp_liq),
    totalLiquido: toNumber(totalRow.totalliq ?? latest?.total_liq),
    deltaP:
      toNumber(rholiqRow.delta_p) ??
      (psiLiq !== null && psiGas !== null ? Number((psiLiq - psiGas).toFixed(2)) : null),
    totalGas: toNumber(totalRow.totalgas ?? latest?.total_gas),
  };

  const flowRate = mapFlowRateSeries(normalizeRows(qmr?.series));
  const vpSeries = mapVpSeries(normalizeRows(vp?.series));
  const rhoSeries = mapRhoSeries(normalizeRows(rho?.series));
  const produccionSeries = mapProduccionSeries(normalizeRows(produccion?.series));

  const latestTime = toEpoch(latest?.timestamp_hmi ?? bootstrap?.server_time) || Date.now();

  const snapshot: DashboardSnapshot = {
    timestamp: latest?.timestamp_hmi || bootstrap?.server_time || new Date().toISOString(),
    metrics,
    series: {
      flowRate: flowRate.length
        ? flowRate
        : [
            {
              time: latestTime,
              gas: toNumber(latest?.qm_gas),
              liquido: toNumber(latest?.qm_liq),
            },
          ],
      vp: vpSeries.length
        ? vpSeries
        : [
            {
              time: latestTime,
              presionGas: toNumber(latest?.pres_f_gas),
              presionLiq: toNumber(latest?.pres_f_liq),
              tempGas: toNumber(latest?.temp_gas),
              tempLiq: toNumber(latest?.temp_liq),
            },
          ],
      rho: rhoSeries.length
        ? rhoSeries
        : [
            {
              time: latestTime,
              densidadGas: toNumber(latest?.densidad_gas),
              densidadLiq: toNumber(latest?.densidad_liq),
            },
          ],
      proCalc: produccionSeries.length
        ? produccionSeries
        : [
            {
              time: latestTime,
              gas: toNumber(totalRow.totalgas ?? latest?.total_gas),
              liquido: toNumber(totalRow.totalliq ?? latest?.total_liq),
            },
          ],
    },
    tables: {
      pressures: [
        {
          fechaHora: formatDateTime(
            pressureRow.time ?? latest?.timestamp_hmi ?? bootstrap?.server_time,
          ),
          psiCabezal: toNumber(pressureRow.presion_cabezal ?? latest?.presion_cabezal),
          psiCasing: toNumber(pressureRow.presion_casing ?? latest?.presion_casing),
          psiLinea: toNumber(pressureRow.presion_linea ?? latest?.presion_linea),
          psiMacolla: toNumber(pressureRow.presion_macolla ?? latest?.presion_macolla),
        },
      ],
    },
  };

  return {
    snapshot,
    bootstrap: bootstrap || null,
  };
};
