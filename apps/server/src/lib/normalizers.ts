import type { SeriesPoint, SnapshotPayload, TableRow } from '../types/data.js';

type UnknownRecord = Record<string, unknown>;

const TIME_KEYS = ['time', 't', 'timestamp', 'datetime', 'date', '_time'] as const;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function pickRowsFromObject(record: UnknownRecord): unknown[] {
  const arrayKeys = ['data', 'rows', 'result', 'results', 'series', 'root_selector', 'values'];

  for (const key of arrayKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      return value;
    }
    const nested = asRecord(value);
    if (nested) {
      const rows = pickRowsFromObject(nested);
      if (rows.length > 0) {
        return rows;
      }
    }
  }

  return [];
}

export function toRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((value): value is UnknownRecord => asRecord(value) !== null);
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const picked = pickRowsFromObject(record);
  if (picked.length > 0) {
    return picked.filter((value): value is UnknownRecord => asRecord(value) !== null);
  }

  return [record];
}

export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceTime(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowTime(row: UnknownRecord): string | null {
  for (const key of TIME_KEYS) {
    const parsed = coerceTime(row[key]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function latestRow(payload: unknown): UnknownRecord {
  const rows = toRows(payload);
  if (rows.length === 0) {
    return {};
  }

  const sorted = [...rows].sort((a, b) => {
    const at = rowTime(a);
    const bt = rowTime(b);
    if (!at || !bt) {
      return 0;
    }
    return at.localeCompare(bt);
  });

  return sorted[sorted.length - 1] ?? {};
}

export function normalizeSnapshot(payloads: {
  clockmeter: unknown;
  drivgain: unknown;
  temp: unknown;
  possvalve: unknown;
  rholiq: unknown;
  total: unknown;
  densidadapi: unknown;
}): { snapshot: SnapshotPayload } {
  const clock = latestRow(payloads.clockmeter);
  const drivgain = latestRow(payloads.drivgain);
  const temp = latestRow(payloads.temp);
  const valve = latestRow(payloads.possvalve);
  const rho = latestRow(payloads.rholiq);
  const total = latestRow(payloads.total);
  const api = latestRow(payloads.densidadapi);

  const timestampCandidates = [
    rowTime(clock),
    rowTime(drivgain),
    rowTime(temp),
    rowTime(valve),
    rowTime(rho),
    rowTime(total),
    rowTime(api),
  ].filter((value): value is string => value !== null);

  const t = timestampCandidates.sort().at(-1) ?? new Date().toISOString();

  return {
    snapshot: {
      t,
      psi_liq: coerceNumber(clock.psi_liq),
      psi_gas: coerceNumber(clock.psi_gas),
      drive_gain_gas: coerceNumber(drivgain.drive_gain_gas),
      drive_gain_liquido: coerceNumber(drivgain.drive_gain_liquido),
      temp_liquido: coerceNumber(temp.temp_liquido),
      temp_gas: coerceNumber(temp.temp_gas),
      posicion_valvula: coerceNumber(valve.posicion_valvula),
      densidad: coerceNumber(rho.densidad),
      totalgas: coerceNumber(total.totalgas),
      totalliq: coerceNumber(total.totalliq),
      api: coerceNumber(api.api),
      vliq: coerceNumber(total.vliq),
      vgas: coerceNumber(total.vgas),
      delta_p: coerceNumber(rho.delta_p),
    },
  };
}

export function normalizeSeries(payload: unknown, fields: string[]): { series: SeriesPoint[] } {
  const rows = toRows(payload);
  const mapped: SeriesPoint[] = rows
    .map((row) => {
      const t = rowTime(row) ?? coerceTime(row['time']);
      if (!t) {
        return null;
      }

      const point: SeriesPoint = { t };
      for (const field of fields) {
        point[field] = coerceNumber(row[field]);
      }
      return point;
    })
    .filter((value): value is SeriesPoint => value !== null)
    .sort((a, b) => a.t.localeCompare(b.t));

  return { series: mapped };
}

export function normalizeTable(payload: unknown, fields: string[]): { table: TableRow[] } {
  const rows = toRows(payload);

  const table = rows
    .map((row) => {
      const time = rowTime(row);
      if (!time) {
        return null;
      }

      const mapped: TableRow = { time };
      for (const field of fields) {
        const raw = row[field];
        if (typeof raw === 'string') {
          mapped[field] = raw;
        } else {
          mapped[field] = coerceNumber(raw);
        }
      }
      return mapped;
    })
    .filter((value): value is TableRow => value !== null)
    .sort((a, b) => b.time.localeCompare(a.time));

  return { table };
}


