import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { PNG } from 'pngjs';

import { fetchExternal } from '@/lib/bff/external-api';
import { toRows } from '@/lib/bff/normalizers';

const TEMPLATE_FILE_NAME = 'FORMATO_DE_REPORTE_FLUXCY_VDF.xlsx';
const SHEET_CORRIDA = 'Corrida';
const SHEET_RESULT_ENTREGA = 'Result.Entrega';
const SHEET_RESULT_PPLES = 'Result. Pples';
const SHEET_GRAFICO = 'Grafico';
const SHEET_FLOW_RATE = 'FLOW RATE';
const START_ROW = 13;
const TOTALS_ROW = 50;
const MAX_ROWS = TOTALS_ROW - START_ROW;
const MAX_RANGE_MS = 12 * 60 * 60 * 1000;
const CYCLE_MINUTES = 20;
const DB_MATCH_WINDOW_MS = 10 * 60 * 1000;
const GAP_WARNING_MS = 40 * 60 * 1000;
const REPORT_TIMEZONE = 'America/New_York';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type UnknownRecord = Record<string, unknown>;

type GenerateCorridaReportInput = {
  fechaInicio: string;
  fechaFin: string;
  pozo: string;
  macolla: string;
  fileName: string;
  requestId: string;
};

type CorridaRecord = {
  timestampMs: number;
  date: Date;
  invLiq: number;
  invGas: number;
  bswLab: number;
  tempLiq: number;
  presionCabezal: number;
  presionCasing: number;
  presFliq: number;
  diluente: number;
  tempEquipoF: number;
};

type DbFluxcyRecord = {
  timestampMs: number;
  qmLiq: number | null;
  qmGas: number | null;
  vdfAmp: number | null;
  vdfCons: number | null;
  vdfTor: number | null;
  vdfVel: number | null;
};

type ParseCorridaResult = {
  rows: CorridaRecord[];
  duplicatesRemoved: number;
  convertedCelsius: boolean;
  gapWarnings: number;
  largestGapMs: number;
};

type GenerateCorridaReportResult = {
  buffer: Buffer;
  fileName: string;
  records: number;
};

export class ReportGenerationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toNodeBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  return Buffer.from(data);
}

function getRecordValue(row: UnknownRecord, key: string): unknown {
  if (key in row) {
    return row[key];
  }

  const normalizedKey = key.toLowerCase();
  for (const [candidateKey, value] of Object.entries(row)) {
    if (candidateKey.toLowerCase() === normalizedKey) {
      return value;
    }
  }

  return undefined;
}

function getFirstAvailableValue(row: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = getRecordValue(row, key);
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.includes(',') && !trimmed.includes('.')
      ? trimmed.replace(',', '.')
      : trimmed;

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(csv: string): UnknownRecord[] {
  const normalized = csv.replace(/^\uFEFF/, '');
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) =>
    header.replace(/^"|"$/g, '').trim().toLowerCase(),
  );

  const rows: UnknownRecord[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseDelimitedLine(lines[index], delimiter);
    const row: UnknownRecord = {};
    for (let col = 0; col < headers.length; col += 1) {
      const key = headers[col];
      if (!key) {
        continue;
      }
      row[key] = values[col] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function requireNumeric(value: unknown, columnName: string): number {
  const parsed = parseNumeric(value);
  if (parsed === null || Number.isNaN(parsed)) {
    throw new ReportGenerationError(400, `Valor invalido en columna ${columnName}.`);
  }
  return parsed;
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function extractDateParts(raw: string): DateParts | null {
  const match = raw.match(
    /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? '0'),
    minute: Number(match[5] ?? '0'),
    second: Number(match[6] ?? '0'),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day' || part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      map[part.type] = Number(part.value);
    }
  }

  const asUtc = Date.UTC(
    map.year,
    (map.month ?? 1) - 1,
    map.day ?? 1,
    map.hour ?? 0,
    map.minute ?? 0,
    map.second ?? 0,
  );

  return asUtc - date.getTime();
}

function dateFromPartsInTimeZone(parts: DateParts, timeZone: string): Date {
  const guessUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset1 = getTimeZoneOffsetMs(new Date(guessUtc), timeZone);
  const adjusted1 = guessUtc - offset1;
  const offset2 = getTimeZoneOffsetMs(new Date(adjusted1), timeZone);
  const adjusted2 = guessUtc - offset2;
  return new Date(adjusted2);
}

function parseDateFromUnknown(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasExplicitOffset = /[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed);
  if (!hasExplicitOffset) {
    const parts = extractDateParts(trimmed);
    if (parts) {
      return dateFromPartsInTimeZone(parts, REPORT_TIMEZONE);
    }
  }

  const maybeIso = trimmed.includes(' ') && !trimmed.includes('T')
    ? trimmed.replace(' ', 'T')
    : trimmed;

  const date = new Date(maybeIso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeDateTimeInput(raw: string, key: 'fechaInicio' | 'fechaFin'): string {
  const value = raw.trim();
  const valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
  if (!valid) {
    throw new ReportGenerationError(400, `${key} debe tener formato YYYY-MM-DDTHH:mm:ss.`);
  }

  return value.length === 16 ? `${value}:00` : value;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function parseDateTimeInputInReportTimezone(value: string): Date | null {
  const parts = extractDateParts(value);
  if (!parts) {
    return null;
  }

  return dateFromPartsInTimeZone(parts, REPORT_TIMEZONE);
}

function addMinutesToDateTimeInput(value: string, minutes: number): string {
  const parts = extractDateParts(value);
  if (!parts) {
    return value;
  }

  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const shifted = new Date(utc + minutes * 60 * 1000);

  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function shouldConvertCelsius(temperatures: number[]): boolean {
  if (temperatures.length === 0) {
    return false;
  }

  const maxValue = Math.max(...temperatures);
  const minValue = Math.min(...temperatures);
  const medianValue = median(temperatures);

  return maxValue <= 70 && minValue >= -40 && medianValue <= 60;
}

function externalApiDateTime(value: string): string {
  return value.replace('T', ' ');
}

function parseCorridaRows(payload: unknown): ParseCorridaResult {
  const rows = typeof payload === 'string' ? parseCsvRows(payload) : (toRows(payload) as UnknownRecord[]);

  const requiredColumns = [
    'fecha_hora',
    'inv_liq',
    'inv_gas',
    'bsw_lab',
    'temp_liq',
    'presion_cabezal',
    'presion_casing',
    'pres_f_liq',
    'diluente',
  ];
  const missingColumns = requiredColumns.filter(
    (column) => !rows.some((row) => getRecordValue(row, column) !== undefined),
  );
  if (missingColumns.length > 0) {
    throw new ReportGenerationError(400, `Faltan columnas requeridas: ${missingColumns.join(', ')}.`);
  }

  const parsed: Omit<CorridaRecord, 'tempEquipoF'>[] = [];

  for (const row of rows) {
    const rawDate = getFirstAvailableValue(row, ['fecha_hora']);
    const parsedDate = parseDateFromUnknown(rawDate);
    if (!parsedDate) {
      throw new ReportGenerationError(400, "Hay valores invalidos en columna fecha_hora.");
    }

    parsed.push({
      timestampMs: parsedDate.getTime(),
      date: parsedDate,
      invLiq: requireNumeric(getFirstAvailableValue(row, ['inv_liq']), 'inv_liq'),
      invGas: requireNumeric(getFirstAvailableValue(row, ['inv_gas']), 'inv_gas'),
      bswLab: requireNumeric(getFirstAvailableValue(row, ['bsw_lab']), 'bsw_lab'),
      tempLiq: requireNumeric(getFirstAvailableValue(row, ['temp_liq']), 'temp_liq'),
      presionCabezal: requireNumeric(getFirstAvailableValue(row, ['presion_cabezal']), 'presion_cabezal'),
      presionCasing: requireNumeric(getFirstAvailableValue(row, ['presion_casing']), 'presion_casing'),
      presFliq: requireNumeric(getFirstAvailableValue(row, ['pres_f_liq']), 'pres_f_liq'),
      diluente: requireNumeric(getFirstAvailableValue(row, ['diluente']), 'diluente'),
    });
  }

  parsed.sort((a, b) => a.timestampMs - b.timestampMs);

  const deduped: Omit<CorridaRecord, 'tempEquipoF'>[] = [];
  let duplicatesRemoved = 0;
  for (const row of parsed) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.timestampMs === row.timestampMs) {
      duplicatesRemoved += 1;
      continue;
    }
    deduped.push(row);
  }

  const convertToFahrenheit = shouldConvertCelsius(deduped.map((item) => item.tempLiq));
  const withTemperature: CorridaRecord[] = deduped.map((item) => ({
    ...item,
    tempEquipoF: convertToFahrenheit ? (item.tempLiq * 9) / 5 + 32 : item.tempLiq,
  }));

  let gapWarnings = 0;
  let largestGapMs = 0;
  for (let index = 1; index < withTemperature.length; index += 1) {
    const gap = withTemperature[index].timestampMs - withTemperature[index - 1].timestampMs;
    if (gap > GAP_WARNING_MS) {
      gapWarnings += 1;
      if (gap > largestGapMs) {
        largestGapMs = gap;
      }
    }
  }

  return {
    rows: withTemperature,
    duplicatesRemoved,
    convertedCelsius: convertToFahrenheit,
    gapWarnings,
    largestGapMs,
  };
}

type ParsedShortTimestamp =
  | { kind: 'time-only'; hour: number; minute: number; second: number }
  | { kind: 'month-day-time'; month: number; day: number; hour: number; minute: number; second: number };

function parseShortTimestamp(raw: string): ParsedShortTimestamp | null {
  const trimmed = raw.trim();

  const monthDayTime = trimmed.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (monthDayTime) {
    const month = Number(monthDayTime[1]);
    const day = Number(monthDayTime[2]);
    const hour = Number(monthDayTime[3]);
    const minute = Number(monthDayTime[4]);
    const second = Number(monthDayTime[5] ?? '0');
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
      return null;
    }
    return { kind: 'month-day-time', month, day, hour, minute, second };
  }

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeOnly) {
    return null;
  }

  const hour = Number(timeOnly[1]);
  const minute = Number(timeOnly[2]);
  const second = Number(timeOnly[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return { kind: 'time-only', hour, minute, second };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const output = new Date(date.getTime());
  output.setDate(output.getDate() + days);
  return output;
}

function shortTimestampCandidates(raw: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const parsed = parseShortTimestamp(raw);
  if (!parsed) {
    return [];
  }

  if (parsed.kind === 'month-day-time') {
    const startYear = rangeStart.getFullYear();
    const endYear = rangeEnd.getFullYear();
    const years = new Set([startYear - 1, startYear, endYear, endYear + 1]);
    const monthDayCandidates: Date[] = [];
    for (const year of years) {
      monthDayCandidates.push(
        dateFromPartsInTimeZone(
          {
            year,
            month: parsed.month,
            day: parsed.day,
            hour: parsed.hour,
            minute: parsed.minute,
            second: parsed.second,
          },
          REPORT_TIMEZONE,
        ),
      );
    }
    return monthDayCandidates;
  }

  const startDay = addDays(startOfLocalDay(rangeStart), -1);
  const endDay = addDays(startOfLocalDay(rangeEnd), 1);
  const candidates: Date[] = [];

  for (let day = startDay; day <= endDay; day = addDays(day, 1)) {
    candidates.push(
      dateFromPartsInTimeZone(
        {
          year: day.getFullYear(),
          month: day.getMonth() + 1,
          day: day.getDate(),
          hour: parsed.hour,
          minute: parsed.minute,
          second: parsed.second,
        },
        REPORT_TIMEZONE,
      ),
    );
  }

  return candidates;
}

function parseDbFluxcyRows(payload: unknown, rangeStart: Date, rangeEnd: Date): DbFluxcyRecord[] {
  const rows = toRows(payload) as UnknownRecord[];
  const recordMap = new Map<number, DbFluxcyRecord>();

  const upsert = (timestampMs: number, source: UnknownRecord) => {
    const current = recordMap.get(timestampMs);
    const nextQmLiq = parseNumeric(getFirstAvailableValue(source, ['qm_liq', 'qmliq', 'qmLiq']));
    const nextQmGas = parseNumeric(getFirstAvailableValue(source, ['qm_gas', 'qmgas', 'qmGas']));
    const nextAmp = parseNumeric(getFirstAvailableValue(source, ['vdf_amp']));
    const nextCons = parseNumeric(getFirstAvailableValue(source, ['vdf_cons']));
    const nextTor = parseNumeric(getFirstAvailableValue(source, ['vdf_tor']));
    const nextVel = parseNumeric(getFirstAvailableValue(source, ['vdf_vel']));

    if (!current) {
      recordMap.set(timestampMs, {
        timestampMs,
        qmLiq: nextQmLiq,
        qmGas: nextQmGas,
        vdfAmp: nextAmp,
        vdfCons: nextCons,
        vdfTor: nextTor,
        vdfVel: nextVel,
      });
      return;
    }

    recordMap.set(timestampMs, {
      timestampMs,
      qmLiq: current.qmLiq ?? nextQmLiq,
      qmGas: current.qmGas ?? nextQmGas,
      vdfAmp: current.vdfAmp ?? nextAmp,
      vdfCons: current.vdfCons ?? nextCons,
      vdfTor: current.vdfTor ?? nextTor,
      vdfVel: current.vdfVel ?? nextVel,
    });
  };

  for (const row of rows) {
    const fullTimestamp = getFirstAvailableValue(row, [
      'timestamp',
      'fecha_hora',
      'fechaHora',
      'datetime',
      'time',
      't',
      '_time',
    ]);

    const parsedDate = parseDateFromUnknown(fullTimestamp);
    if (parsedDate) {
      upsert(parsedDate.getTime(), row);
      continue;
    }

    const timestampShort = getFirstAvailableValue(row, ['timestamp_short']);
    if (typeof timestampShort !== 'string' || timestampShort.trim().length === 0) {
      continue;
    }

    const candidates = shortTimestampCandidates(timestampShort, rangeStart, rangeEnd);
    for (const candidate of candidates) {
      upsert(candidate.getTime(), row);
    }
  }

  return [...recordMap.values()].sort((a, b) => a.timestampMs - b.timestampMs);
}

function findNearestDbFluxcyMatch(targetMs: number, rows: DbFluxcyRecord[]): DbFluxcyRecord | null {
  if (rows.length === 0) {
    return null;
  }

  let left = 0;
  let right = rows.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const current = rows[middle].timestampMs;
    if (current === targetMs) {
      return rows[middle];
    }
    if (current < targetMs) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  const candidateIndexes = [left - 1, left, left + 1];
  let best: DbFluxcyRecord | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const index of candidateIndexes) {
    if (index < 0 || index >= rows.length) {
      continue;
    }

    const candidate = rows[index];
    const delta = Math.abs(candidate.timestampMs - targetMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  if (!best || bestDelta > DB_MATCH_WINDOW_MS) {
    return null;
  }

  return best;
}

function formatForSheet(date: Date): { fecha: string; hora: string } {
  return {
    fecha: DATE_FORMATTER.format(date),
    hora: TIME_FORMATTER.format(date),
  };
}

async function resolveTemplatePath(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), 'public', 'templates', TEMPLATE_FILE_NAME),
    path.join(process.cwd(), 'apps', 'web', 'public', 'templates', TEMPLATE_FILE_NAME),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Intentionally empty: check next path candidate.
    }
  }

  throw new ReportGenerationError(
    500,
    `No existe la plantilla ${TEMPLATE_FILE_NAME} en /public/templates.`,
  );
}

function sanitizeFileName(rawName: string): string {
  const noExtension = rawName.replace(/\.xlsx$/i, '').trim();
  const safe = noExtension.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  return safe.slice(0, 120);
}

function toReadableMinutes(ms: number): string {
  return (ms / (60 * 1000)).toFixed(1);
}

type FlowPoint = {
  timestampMs: number;
  value: number;
};

type FlowRateSeries = {
  liq: FlowPoint[];
  gas: FlowPoint[];
};

const PIXEL_FONT: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00110', '00110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '/': ['00001', '00010', '00100', '01000', '10000', '00000', '00000'],
  '0': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '11100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

function createFlowRatePng(series: FlowRateSeries): Buffer {
  const width = 1360;
  const height = 760;
  const chart = { left: 106, right: 1252, top: 96, bottom: 664 };
  const chartWidth = chart.right - chart.left;
  const chartHeight = chart.bottom - chart.top;
  const png = new PNG({ width, height });

  type RgbColor = { r: number; g: number; b: number; a?: number };
  const colors = {
    white: { r: 255, g: 255, b: 255 },
    plotBg: { r: 244, g: 246, b: 248 },
    frame: { r: 158, g: 166, b: 178 },
    grid: { r: 216, g: 221, b: 230 },
    axis: { r: 115, g: 123, b: 136 },
    text: { r: 36, g: 46, b: 61 },
    liq: { r: 56, g: 133, b: 255 },
    gas: { r: 245, g: 127, b: 50 },
    liqSoft: { r: 56, g: 133, b: 255, a: 80 },
    gasSoft: { r: 245, g: 127, b: 50, a: 80 },
  } as const;

  const setPixel = (x: number, y: number, color: RgbColor) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) {
      return;
    }
    const idx = (width * py + px) << 2;
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = color.a ?? 255;
  };

  const fillRect = (x: number, y: number, w: number, h: number, color: RgbColor) => {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(width - 1, Math.floor(x + w));
    const y1 = Math.min(height - 1, Math.floor(y + h));
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        setPixel(px, py, color);
      }
    }
  };

  const drawLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: RgbColor,
    thickness = 1,
  ) => {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const targetX = Math.round(x1);
    const targetY = Math.round(y1);
    const dx = Math.abs(targetX - x);
    const sx = x < targetX ? 1 : -1;
    const dy = -Math.abs(targetY - y);
    const sy = y < targetY ? 1 : -1;
    let error = dx + dy;
    const radius = Math.max(0, Math.floor((thickness - 1) / 2));

    while (true) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        for (let oy = -radius; oy <= radius; oy += 1) {
          setPixel(x + ox, y + oy, color);
        }
      }
      if (x === targetX && y === targetY) {
        break;
      }
      const e2 = 2 * error;
      if (e2 >= dy) {
        error += dy;
        x += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y += sy;
      }
    }
  };

  const drawCircle = (cx: number, cy: number, radius: number, color: RgbColor) => {
    const r2 = radius * radius;
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (x * x + y * y <= r2) {
          setPixel(cx + x, cy + y, color);
        }
      }
    }
  };

  const drawDashedHorizontal = (y: number, color: RgbColor) => {
    const dash = 8;
    const gap = 5;
    for (let x = chart.left; x < chart.right; x += dash + gap) {
      drawLine(x, y, Math.min(x + dash, chart.right), y, color, 1);
    }
  };

  const drawText = (
    x: number,
    y: number,
    text: string,
    color: RgbColor,
    scale = 2,
    align: 'left' | 'center' | 'right' = 'left',
  ) => {
    const content = text.toUpperCase();
    const charWidth = 5 * scale;
    const spacing = scale;
    const totalWidth = content.length === 0 ? 0 : content.length * charWidth + (content.length - 1) * spacing;

    let cursorX = x;
    if (align === 'center') {
      cursorX = x - totalWidth / 2;
    } else if (align === 'right') {
      cursorX = x - totalWidth;
    }

    for (const char of content) {
      const glyph = PIXEL_FONT[char] ?? PIXEL_FONT['?'];
      for (let row = 0; row < glyph.length; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < line.length; col += 1) {
          if (line[col] === '1') {
            fillRect(cursorX + col * scale, y + row * scale, scale - 0.2, scale - 0.2, color);
          }
        }
      }
      cursorX += charWidth + spacing;
    }
  };

  const formatValue = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return value.toFixed(0);
    }
    if (abs >= 100) {
      return value.toFixed(1);
    }
    return value.toFixed(2);
  };

  const getBounds = (points: FlowPoint[]) => {
    if (points.length === 0) {
      return { min: 0, max: 1 };
    }
    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));
    if (min === max) {
      const offset = Math.max(Math.abs(max) * 0.1, 1);
      return { min: min - offset, max: max + offset };
    }
    const span = max - min;
    const pad = span * 0.12;
    return { min: min - pad, max: max + pad };
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  fillRect(0, 0, width, height, colors.white);
  fillRect(chart.left, chart.top, chartWidth, chartHeight, colors.plotBg);

  drawLine(chart.left, chart.top, chart.right, chart.top, colors.frame, 1);
  drawLine(chart.left, chart.bottom, chart.right, chart.bottom, colors.axis, 2);
  drawLine(chart.left, chart.top, chart.left, chart.bottom, colors.axis, 2);
  drawLine(chart.right, chart.top, chart.right, chart.bottom, colors.axis, 2);

  const allPoints = [...series.liq, ...series.gas].sort((a, b) => a.timestampMs - b.timestampMs);
  if (allPoints.length < 2) {
    drawText(width / 2, height / 2 - 12, 'SIN DATA FLOW RATE', colors.text, 3, 'center');
    return PNG.sync.write(png);
  }

  const minTime = allPoints[0].timestampMs;
  const maxTime = allPoints[allPoints.length - 1].timestampMs;
  const timeSpan = Math.max(maxTime - minTime, 1);

  const liqBounds = getBounds(series.liq);
  const gasBounds = getBounds(series.gas);

  const toX = (timestampMs: number) => chart.left + ((timestampMs - minTime) / timeSpan) * chartWidth;
  const toYLiq = (value: number) =>
    chart.bottom - ((value - liqBounds.min) / Math.max(liqBounds.max - liqBounds.min, 1e-9)) * chartHeight;
  const toYGas = (value: number) =>
    chart.bottom - ((value - gasBounds.min) / Math.max(gasBounds.max - gasBounds.min, 1e-9)) * chartHeight;

  const getExtremes = (points: FlowPoint[]) => {
    if (points.length === 0) {
      return null;
    }
    let min = points[0];
    let max = points[0];
    for (const point of points) {
      if (point.value < min.value) {
        min = point;
      }
      if (point.value > max.value) {
        max = point;
      }
    }
    return { min, max };
  };

  const horizontalTicks = 6;
  const verticalTicks = 8;

  for (let i = 0; i <= horizontalTicks; i += 1) {
    const y = chart.top + (chartHeight * i) / horizontalTicks;
    drawLine(chart.left, y, chart.right, y, colors.grid, 1);
  }

  for (let i = 0; i <= verticalTicks; i += 1) {
    const x = chart.left + (chartWidth * i) / verticalTicks;
    drawLine(x, chart.top, x, chart.bottom, colors.grid, 1);
  }

  for (let i = 0; i <= horizontalTicks; i += 1) {
    const y = chart.top + (chartHeight * i) / horizontalTicks;
    const value = liqBounds.max - ((liqBounds.max - liqBounds.min) * i) / horizontalTicks;
    drawText(chart.left - 12, y - 7, formatValue(value), colors.liq, 2, 'right');
  }

  for (let i = 0; i <= horizontalTicks; i += 1) {
    const y = chart.top + (chartHeight * i) / horizontalTicks;
    const value = gasBounds.max - ((gasBounds.max - gasBounds.min) * i) / horizontalTicks;
    drawText(chart.right + 12, y - 7, formatValue(value), colors.gas, 2, 'left');
  }

  for (let i = 0; i <= verticalTicks; i += 1) {
    const x = chart.left + (chartWidth * i) / verticalTicks;
    const tickTime = new Date(minTime + (timeSpan * i) / verticalTicks);
    const label = TIME_FORMATTER.format(tickTime);
    drawText(x, chart.bottom + 18, label, colors.text, 2, 'center');
  }

  const drawSeries = (points: FlowPoint[], yFn: (value: number) => number, color: RgbColor) => {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      drawLine(
        toX(previous.timestampMs),
        yFn(previous.value),
        toX(current.timestampMs),
        yFn(current.value),
        color,
        2,
      );
    }
  };

  if (series.liq.length >= 2) {
    drawSeries(series.liq, toYLiq, colors.liq);
  }
  if (series.gas.length >= 2) {
    drawSeries(series.gas, toYGas, colors.gas);
  }

  const liqExtremes = getExtremes(series.liq);
  const gasExtremes = getExtremes(series.gas);

  if (liqExtremes) {
    const xMax = toX(liqExtremes.max.timestampMs);
    const yMax = toYLiq(liqExtremes.max.value);
    const xMin = toX(liqExtremes.min.timestampMs);
    const yMin = toYLiq(liqExtremes.min.value);

    drawDashedHorizontal(yMax, colors.liqSoft);
    drawDashedHorizontal(yMin, colors.liqSoft);
    drawCircle(xMax, yMax, 4, colors.liq);
    drawCircle(xMin, yMin, 4, colors.liq);
    drawText(
      clamp(xMax + 10, chart.left + 6, chart.right - 210),
      clamp(yMax - 20, chart.top + 4, chart.bottom - 50),
      `LIQ MAX ${formatValue(liqExtremes.max.value)}`,
      colors.liq,
      2,
      'left',
    );
    drawText(
      clamp(xMin + 10, chart.left + 6, chart.right - 210),
      clamp(yMin + 8, chart.top + 4, chart.bottom - 20),
      `LIQ MIN ${formatValue(liqExtremes.min.value)}`,
      colors.liq,
      2,
      'left',
    );
  }

  if (gasExtremes) {
    const xMax = toX(gasExtremes.max.timestampMs);
    const yMax = toYGas(gasExtremes.max.value);
    const xMin = toX(gasExtremes.min.timestampMs);
    const yMin = toYGas(gasExtremes.min.value);

    drawDashedHorizontal(yMax, colors.gasSoft);
    drawDashedHorizontal(yMin, colors.gasSoft);
    drawCircle(xMax, yMax, 4, colors.gas);
    drawCircle(xMin, yMin, 4, colors.gas);
    drawText(
      clamp(xMax - 200, chart.left + 6, chart.right - 210),
      clamp(yMax - 20, chart.top + 4, chart.bottom - 50),
      `GAS MAX ${formatValue(gasExtremes.max.value)}`,
      colors.gas,
      2,
      'left',
    );
    drawText(
      clamp(xMin - 200, chart.left + 6, chart.right - 210),
      clamp(yMin + 8, chart.top + 4, chart.bottom - 20),
      `GAS MIN ${formatValue(gasExtremes.min.value)}`,
      colors.gas,
      2,
      'left',
    );
  }

  drawText(chart.left, 26, 'RELACION FLOW RATE LIQUIDO / FLOW RATE GAS', colors.text, 3, 'left');
  drawText(chart.left, 56, 'IZQ LIQ', colors.liq, 2, 'left');
  drawText(chart.right, 56, 'DER GAS', colors.gas, 2, 'right');

  const legendY = chart.top - 34;
  drawLine(chart.right - 280, legendY, chart.right - 235, legendY, colors.liq, 3);
  drawText(chart.right - 225, legendY - 8, 'LIQ', colors.liq, 2, 'left');
  drawLine(chart.right - 160, legendY, chart.right - 115, legendY, colors.gas, 3);
  drawText(chart.right - 105, legendY - 8, 'GAS', colors.gas, 2, 'left');

  return PNG.sync.write(png);
}

function getWorksheetByNameTrimmed(workbook: ExcelJS.Workbook, sheetName: string): ExcelJS.Worksheet | undefined {
  return workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === sheetName.trim().toLowerCase());
}

function replaceExactStringValues(workbook: ExcelJS.Workbook, fromValue: string, toValue: string) {
  for (const sheet of workbook.worksheets) {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'string' && cell.value.trim() === fromValue) {
          cell.value = toValue;
        }
      });
    });
  }
}

function writePozoToTemplate(workbook: ExcelJS.Workbook, pozo: string) {
  const targets = [
    { sheetName: SHEET_CORRIDA, cell: 'K8' },
    { sheetName: SHEET_RESULT_ENTREGA, cell: 'C10' },
    { sheetName: SHEET_RESULT_ENTREGA, cell: 'C11' },
    { sheetName: SHEET_RESULT_PPLES, cell: 'H18' },
    { sheetName: SHEET_GRAFICO, cell: 'H4' },
    { sheetName: SHEET_FLOW_RATE, cell: 'D4' },
  ];

  for (const target of targets) {
    const sheet = getWorksheetByNameTrimmed(workbook, target.sheetName);
    if (!sheet) {
      continue;
    }
    sheet.getCell(target.cell).value = pozo;
  }
}

function buildFallbackFlowSeries(
  corridaRows: CorridaRecord[],
  key: 'invLiq' | 'invGas',
): FlowPoint[] {
  const fallback: FlowPoint[] = [];
  for (let index = 1; index < corridaRows.length; index += 1) {
    const previous = corridaRows[index - 1];
    const current = corridaRows[index];
    const elapsedHours = (current.timestampMs - previous.timestampMs) / (60 * 60 * 1000);
    if (elapsedHours <= 0) {
      continue;
    }

    const flowPerHour = (current[key] - previous[key]) / elapsedHours;
    if (Number.isFinite(flowPerHour)) {
      fallback.push({ timestampMs: current.timestampMs, value: flowPerHour });
    }
  }
  return fallback;
}

function buildFlowRateSeries(dbRows: DbFluxcyRecord[], corridaRows: CorridaRecord[]): FlowRateSeries {
  const fromDbLiq = dbRows
    .filter((row) => row.qmLiq !== null && Number.isFinite(row.qmLiq))
    .map((row) => ({ timestampMs: row.timestampMs, value: row.qmLiq as number }))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const fromDbGas = dbRows
    .filter((row) => row.qmGas !== null && Number.isFinite(row.qmGas))
    .map((row) => ({ timestampMs: row.timestampMs, value: row.qmGas as number }))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  return {
    liq: fromDbLiq.length >= 2 ? fromDbLiq : buildFallbackFlowSeries(corridaRows, 'invLiq'),
    gas: fromDbGas.length >= 2 ? fromDbGas : buildFallbackFlowSeries(corridaRows, 'invGas'),
  };
}

function insertFlowRateSnapshot(workbook: ExcelJS.Workbook, flowRateSeries: FlowRateSeries, requestId: string) {
  const sheetFlowRate = getWorksheetByNameTrimmed(workbook, SHEET_FLOW_RATE);
  if (!sheetFlowRate) {
    console.warn(`[reports][${requestId}] No existe hoja FLOW RATE para insertar captura.`);
    return;
  }

  const images = sheetFlowRate.getImages();
  const targetImage = [...images]
    .map((image) => {
      const area = (image.range.br.col - image.range.tl.col) * (image.range.br.row - image.range.tl.row);
      return { image, area };
    })
    .sort((a, b) => b.area - a.area)[0]?.image;

  const targetRange = targetImage
    ? {
        tl: { col: targetImage.range.tl.col, row: targetImage.range.tl.row },
        br: { col: targetImage.range.br.col, row: targetImage.range.br.row },
        editAs: 'oneCell' as const,
      }
    : {
        tl: { col: 0, row: 4 },
        br: { col: 11, row: 21 },
        editAs: 'oneCell' as const,
      };

  const pngBuffer = createFlowRatePng(flowRateSeries);
  const imageId = (workbook as unknown as { addImage: (params: unknown) => number }).addImage({
    buffer: pngBuffer,
    extension: 'png',
  });

  (sheetFlowRate as unknown as { addImage: (id: number, range: unknown) => void }).addImage(
    imageId,
    targetRange,
  );
}

async function restoreGraphArtifacts(templateBuffer: Buffer, generatedBuffer: Buffer): Promise<Buffer> {
  const templateZip = await JSZip.loadAsync(templateBuffer);
  const generatedZip = await JSZip.loadAsync(generatedBuffer);

  const chartPaths = [
    'xl/charts/chart1.xml',
    'xl/drawings/drawing4.xml',
    'xl/drawings/_rels/drawing4.xml.rels',
  ];

  for (const chartPath of chartPaths) {
    const templateEntry = templateZip.file(chartPath);
    if (!templateEntry) {
      continue;
    }
    const content = await templateEntry.async('nodebuffer');
    generatedZip.file(chartPath, content);
  }

  const contentTypesPath = '[Content_Types].xml';
  const templateContentTypesEntry = templateZip.file(contentTypesPath);
  const generatedContentTypesEntry = generatedZip.file(contentTypesPath);

  if (templateContentTypesEntry && generatedContentTypesEntry) {
    const templateContentTypes = await templateContentTypesEntry.async('string');
    const generatedContentTypes = await generatedContentTypesEntry.async('string');

    const chartOverride = /<Override[^>]*PartName="\/xl\/charts\/chart1\.xml"[^>]*\/>/.exec(
      templateContentTypes,
    )?.[0];

    if (chartOverride && !generatedContentTypes.includes('/xl/charts/chart1.xml')) {
      const patchedContentTypes = generatedContentTypes.replace('</Types>', `${chartOverride}</Types>`);
      generatedZip.file(contentTypesPath, patchedContentTypes);
    }
  }

  return generatedZip.generateAsync({ type: 'nodebuffer' });
}

export async function generateCorridaReport(
  input: GenerateCorridaReportInput,
): Promise<GenerateCorridaReportResult> {
  const fechaInicio = normalizeDateTimeInput(input.fechaInicio, 'fechaInicio');
  const fechaFin = normalizeDateTimeInput(input.fechaFin, 'fechaFin');
  const pozo = input.pozo.trim();
  const macolla = input.macolla.trim();
  const fileName = sanitizeFileName(input.fileName);

  if (!pozo) {
    throw new ReportGenerationError(400, 'pozo es obligatorio.');
  }
  if (!macolla) {
    throw new ReportGenerationError(400, 'macolla es obligatorio.');
  }
  if (!fileName) {
    throw new ReportGenerationError(400, 'fileName es obligatorio y no debe incluir extension.');
  }

  const rangeStart = parseDateTimeInputInReportTimezone(fechaInicio);
  const rangeEnd = parseDateTimeInputInReportTimezone(fechaFin);
  if (!rangeStart || !rangeEnd || Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new ReportGenerationError(400, 'fechaInicio/fechaFin son invalidas.');
  }
  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    throw new ReportGenerationError(400, 'fechaFin debe ser mayor a fechaInicio.');
  }

  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  if (rangeMs > MAX_RANGE_MS) {
    throw new ReportGenerationError(400, 'El rango maximo permitido es de 12 horas.');
  }

  const fechaFinForApi = addMinutesToDateTimeInput(fechaFin, CYCLE_MINUTES);
  const corridaPayload = await fetchExternal('/datos/corrida-pozo', {
    fechaInicio: externalApiDateTime(fechaInicio),
    fechaFin: externalApiDateTime(fechaFinForApi),
  });

  let dbFluxcyPayload: unknown = [];
  let dbFluxcyUnavailable = false;
  try {
    const dbFechaFin = addMinutesToDateTimeInput(fechaFin, CYCLE_MINUTES);
    dbFluxcyPayload = await fetchExternal('/databasefluxcy', {
      from: externalApiDateTime(fechaInicio),
      to: externalApiDateTime(dbFechaFin),
    });

    const rangedRows = toRows(dbFluxcyPayload);
    if (rangedRows.length === 0) {
      console.warn(
        `[reports][${input.requestId}] databasefluxcy con from/to no devolvio filas. Se intenta fallback sin rango.`,
      );
      dbFluxcyPayload = await fetchExternal('/databasefluxcy');
    }
  } catch (error) {
    const rangedError = error instanceof Error ? error.message : 'unknown source error';
    console.warn(
      `[reports][${input.requestId}] databasefluxcy con from/to fallo: ${rangedError}. Se intenta fallback sin rango.`,
    );
    try {
      dbFluxcyPayload = await fetchExternal('/databasefluxcy');
    } catch (fallbackError) {
      dbFluxcyUnavailable = true;
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : 'unknown source error';
      console.warn(
        `[reports][${input.requestId}] databasefluxcy no disponible: ${fallbackMessage}. El reporte continuara sin VDF (V/W/X/Y).`,
      );
    }
  }

  const corridaParsed = parseCorridaRows(corridaPayload);
  const corridaRows = corridaParsed.rows.filter(
    (row) => row.timestampMs >= rangeStart.getTime() && row.timestampMs <= rangeEnd.getTime(),
  );
  if (corridaRows.length === 0) {
    throw new ReportGenerationError(400, 'No hay data en rango.');
  }
  if (corridaRows.length > MAX_ROWS) {
    throw new ReportGenerationError(
      400,
      `El formato permite ${MAX_ROWS} registros. La corrida trae ${corridaRows.length}. Reduce el rango.`,
    );
  }

  if (corridaParsed.duplicatesRemoved > 0) {
    console.warn(
      `[reports][${input.requestId}] Corrida duplicada: removidos ${corridaParsed.duplicatesRemoved} registros por timestamp.`,
    );
  }
  if (corridaParsed.gapWarnings > 0) {
    console.warn(
      `[reports][${input.requestId}] Corrida con ${corridaParsed.gapWarnings} gaps > 40 min. Mayor gap ${toReadableMinutes(corridaParsed.largestGapMs)} min.`,
    );
  }
  if (corridaParsed.convertedCelsius) {
    console.warn(`[reports][${input.requestId}] Temperatura detectada en C; se convierte a F para columna R.`);
  }

  const dbFluxcyRows = parseDbFluxcyRows(dbFluxcyPayload, rangeStart, rangeEnd);
  const dbFluxcyRowsInRange = dbFluxcyRows.filter(
    (row) => row.timestampMs >= rangeStart.getTime() && row.timestampMs <= rangeEnd.getTime(),
  );
  let missingMatches = 0;

  const templatePath = await resolveTemplatePath();
  const templateBuffer = await readFile(templatePath);
  const templateArrayBuffer = templateBuffer.buffer.slice(
    templateBuffer.byteOffset,
    templateBuffer.byteOffset + templateBuffer.byteLength,
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateArrayBuffer);

  const sheetCorrida = workbook.getWorksheet(SHEET_CORRIDA);
  if (!sheetCorrida) {
    throw new ReportGenerationError(500, `No existe la hoja ${SHEET_CORRIDA} en la plantilla.`);
  }

  const sheetResultEntrega = workbook.getWorksheet(SHEET_RESULT_ENTREGA);
  if (!sheetResultEntrega) {
    throw new ReportGenerationError(500, `No existe la hoja ${SHEET_RESULT_ENTREGA} en la plantilla.`);
  }

  replaceExactStringValues(workbook, 'H1B P01', pozo);
  writePozoToTemplate(workbook, pozo);
  sheetResultEntrega.getCell('J11').value = macolla;

  const inputColumns = ['B', 'C', 'D', 'I', 'K', 'M', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'] as const;
  const intentionallyBlankCells = new Set<string>();
  const inputRowsCount = TOTALS_ROW - START_ROW;

  for (const column of inputColumns) {
    const blankAddresses: string[] = [];

    for (let row = START_ROW; row < TOTALS_ROW; row += 1) {
      const address = `${column}${row}`;
      const value = sheetCorrida.getCell(address).value;
      const hasFormula = typeof value === 'object' && value !== null && 'formula' in value;

      if (hasFormula) {
        continue;
      }

      if (value === null || value === undefined || value === '') {
        blankAddresses.push(address);
      }
    }

    if (blankAddresses.length > 0 && blankAddresses.length < inputRowsCount) {
      for (const address of blankAddresses) {
        intentionallyBlankCells.add(address);
      }
    }
  }

  for (let row = START_ROW; row < TOTALS_ROW; row += 1) {
    for (const column of inputColumns) {
      const address = `${column}${row}`;
      if (intentionallyBlankCells.has(address)) {
        continue;
      }
      sheetCorrida.getCell(address).value = null;
    }
  }

  const writeInputCell = (address: string, value: number | string | null | undefined) => {
    if (intentionallyBlankCells.has(address)) {
      return;
    }
    if (value === null || value === undefined || value === '') {
      return;
    }
    sheetCorrida.getCell(address).value = value;
  };

  corridaRows.forEach((row, index) => {
    const excelRow = START_ROW + index;
    const { fecha, hora } = formatForSheet(row.date);
    const dbMatch = findNearestDbFluxcyMatch(row.timestampMs, dbFluxcyRowsInRange);
    if (!dbMatch) {
      missingMatches += 1;
    }

    writeInputCell(`B${excelRow}`, fecha);
    writeInputCell(`C${excelRow}`, hora);
    writeInputCell(`D${excelRow}`, row.invLiq);
    writeInputCell(`I${excelRow}`, row.bswLab);
    writeInputCell(`K${excelRow}`, row.diluente);
    writeInputCell(`M${excelRow}`, row.invGas);
    writeInputCell(`R${excelRow}`, row.tempEquipoF);
    writeInputCell(`S${excelRow}`, row.presionCabezal);
    writeInputCell(`T${excelRow}`, row.presionCasing);
    writeInputCell(`U${excelRow}`, row.presFliq);
    writeInputCell(`V${excelRow}`, dbMatch?.vdfAmp ?? null);
    writeInputCell(`W${excelRow}`, dbMatch?.vdfCons ?? null);
    writeInputCell(`X${excelRow}`, dbMatch?.vdfTor ?? null);
    writeInputCell(`Y${excelRow}`, dbMatch?.vdfVel ?? null);
  });

  if (dbFluxcyUnavailable) {
    console.warn(
      `[reports][${input.requestId}] Reporte generado sin databasefluxcy. Columnas V/W/X/Y quedan vacias.`,
    );
  } else if (missingMatches > 0) {
    console.warn(
      `[reports][${input.requestId}] databasefluxcy sin match temporal para ${missingMatches}/${corridaRows.length} registros.`,
    );
  }

  const flowRateSeries = buildFlowRateSeries(dbFluxcyRowsInRange, corridaRows);
  if (flowRateSeries.liq.length < 2) {
    console.warn(
      `[reports][${input.requestId}] FLOW RATE con datos insuficientes para qm_liq (${flowRateSeries.liq.length} puntos).`,
    );
  }
  if (flowRateSeries.gas.length < 2) {
    console.warn(
      `[reports][${input.requestId}] FLOW RATE con datos insuficientes para qm_gas (${flowRateSeries.gas.length} puntos).`,
    );
  }
  insertFlowRateSnapshot(workbook, flowRateSeries, input.requestId);

  const reportBuffer = await workbook.xlsx.writeBuffer();
  const reportNodeBuffer = toNodeBuffer(reportBuffer);
  const finalBuffer = await restoreGraphArtifacts(templateBuffer, reportNodeBuffer);

  return {
    buffer: finalBuffer,
    fileName,
    records: corridaRows.length,
  };
}
