import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';

import { fetchExternal } from '@/lib/bff/external-api';
import { toRows } from '@/lib/bff/normalizers';

const TEMPLATE_FILE_NAME = 'FORMATO_DE_REPORTE_FLUXCY_VDF.xlsx';
const SHEET_CORRIDA = 'Corrida';
const SHEET_RESULT_ENTREGA = 'Result.Entrega';
const START_ROW = 13;
const TOTALS_ROW = 50;
const MAX_ROWS = TOTALS_ROW - START_ROW;
const MAX_RANGE_MS = 12 * 60 * 60 * 1000;
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
    const nextAmp = parseNumeric(getFirstAvailableValue(source, ['vdf_amp']));
    const nextCons = parseNumeric(getFirstAvailableValue(source, ['vdf_cons']));
    const nextTor = parseNumeric(getFirstAvailableValue(source, ['vdf_tor']));
    const nextVel = parseNumeric(getFirstAvailableValue(source, ['vdf_vel']));

    if (!current) {
      recordMap.set(timestampMs, {
        timestampMs,
        vdfAmp: nextAmp,
        vdfCons: nextCons,
        vdfTor: nextTor,
        vdfVel: nextVel,
      });
      return;
    }

    recordMap.set(timestampMs, {
      timestampMs,
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

  const rangeStart = new Date(fechaInicio);
  const rangeEnd = new Date(fechaFin);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new ReportGenerationError(400, 'fechaInicio/fechaFin son invalidas.');
  }
  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    throw new ReportGenerationError(400, 'fechaFin debe ser mayor a fechaInicio.');
  }

  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  if (rangeMs > MAX_RANGE_MS) {
    throw new ReportGenerationError(400, 'El rango maximo permitido es de 12 horas.');
  }

  const [corridaPayload, dbFluxcyPayload] = await Promise.all([
    fetchExternal('/datos/corrida-pozo', {
      fechaInicio: externalApiDateTime(fechaInicio),
      fechaFin: externalApiDateTime(fechaFin),
    }),
    fetchExternal('/databasefluxcy'),
  ]);

  const corrida = parseCorridaRows(corridaPayload);
  if (corrida.rows.length === 0) {
    throw new ReportGenerationError(400, 'No hay data en rango.');
  }
  if (corrida.rows.length > MAX_ROWS) {
    throw new ReportGenerationError(
      400,
      `El formato permite ${MAX_ROWS} registros. La corrida trae ${corrida.rows.length}. Reduce el rango.`,
    );
  }

  if (corrida.duplicatesRemoved > 0) {
    console.warn(
      `[reports][${input.requestId}] Corrida duplicada: removidos ${corrida.duplicatesRemoved} registros por timestamp.`,
    );
  }
  if (corrida.gapWarnings > 0) {
    console.warn(
      `[reports][${input.requestId}] Corrida con ${corrida.gapWarnings} gaps > 40 min. Mayor gap ${toReadableMinutes(corrida.largestGapMs)} min.`,
    );
  }
  if (corrida.convertedCelsius) {
    console.warn(`[reports][${input.requestId}] Temperatura detectada en C; se convierte a F para columna R.`);
  }

  const dbFluxcyRows = parseDbFluxcyRows(dbFluxcyPayload, rangeStart, rangeEnd);
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

  sheetCorrida.getCell('K8').value = pozo;
  sheetResultEntrega.getCell('J11').value = macolla;

  const inputColumns = ['B', 'C', 'D', 'I', 'K', 'M', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];
  for (let row = START_ROW; row < TOTALS_ROW; row += 1) {
    for (const column of inputColumns) {
      sheetCorrida.getCell(`${column}${row}`).value = null;
    }
  }

  corrida.rows.forEach((row, index) => {
    const excelRow = START_ROW + index;
    const { fecha, hora } = formatForSheet(row.date);
    const dbMatch = findNearestDbFluxcyMatch(row.timestampMs, dbFluxcyRows);
    if (!dbMatch) {
      missingMatches += 1;
    }

    sheetCorrida.getCell(`B${excelRow}`).value = fecha;
    sheetCorrida.getCell(`C${excelRow}`).value = hora;
    sheetCorrida.getCell(`D${excelRow}`).value = row.invLiq;
    sheetCorrida.getCell(`I${excelRow}`).value = row.bswLab;
    sheetCorrida.getCell(`K${excelRow}`).value = row.diluente;
    sheetCorrida.getCell(`M${excelRow}`).value = row.invGas;
    sheetCorrida.getCell(`R${excelRow}`).value = row.tempEquipoF;
    sheetCorrida.getCell(`S${excelRow}`).value = row.presionCabezal;
    sheetCorrida.getCell(`T${excelRow}`).value = row.presionCasing;
    sheetCorrida.getCell(`U${excelRow}`).value = row.presFliq;
    sheetCorrida.getCell(`V${excelRow}`).value = dbMatch?.vdfAmp ?? null;
    sheetCorrida.getCell(`W${excelRow}`).value = dbMatch?.vdfCons ?? null;
    sheetCorrida.getCell(`X${excelRow}`).value = dbMatch?.vdfTor ?? null;
    sheetCorrida.getCell(`Y${excelRow}`).value = dbMatch?.vdfVel ?? null;
  });

  if (missingMatches > 0) {
    console.warn(
      `[reports][${input.requestId}] databasefluxcy sin match temporal para ${missingMatches}/${corrida.rows.length} registros.`,
    );
  }

  const reportBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: toNodeBuffer(reportBuffer),
    fileName,
    records: corrida.rows.length,
  };
}
