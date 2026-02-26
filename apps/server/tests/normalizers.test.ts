import { describe, expect, it } from 'vitest';

import { normalizeSeries, normalizeSnapshot, normalizeTable } from '../src/lib/normalizers.js';

describe('normalizers', () => {
  it('normaliza snapshot con endpoints dispersos', () => {
    const payload = normalizeSnapshot({
      clockmeter: [{ time: '2026-02-25T10:00:00Z', psi_liq: '100', psi_gas: 90 }],
      drivgain: [{ time: '2026-02-25T10:00:00Z', drive_gain_gas: 1.2, drive_gain_liquido: '1.1' }],
      temp: [{ time: '2026-02-25T10:00:00Z', temp_liquido: 30, temp_gas: 35 }],
      possvalve: [{ time: '2026-02-25T10:00:00Z', posicion_valvula: 45 }],
      rholiq: [{ time: '2026-02-25T10:00:00Z', densidad: 0.83, delta_p: 7 }],
      total: [{ time: '2026-02-25T10:00:00Z', totalgas: 200, totalliq: 140, vliq: 20, vgas: 18 }],
      densidadapi: [{ time: '2026-02-25T10:00:00Z', api: 32 }],
    });

    expect(payload.snapshot.psi_liq).toBe(100);
    expect(payload.snapshot.delta_p).toBe(7);
    expect(payload.snapshot.api).toBe(32);
  });

  it('normaliza series en orden ascendente por fecha', () => {
    const payload = normalizeSeries(
      [
        { time: '2026-02-25T10:01:00Z', qm_liq: 4, qm_gas: 5 },
        { time: '2026-02-25T10:00:00Z', qm_liq: 2, qm_gas: 3 },
      ],
      ['qm_liq', 'qm_gas'],
    );

    expect(payload.series[0]?.t).toBe('2026-02-25T10:00:00.000Z');
    expect(payload.series[1]?.qm_liq).toBe(4);
  });

  it('normaliza tabla en orden descendente por fecha', () => {
    const payload = normalizeTable(
      [
        { time: '2026-02-25T10:00:00Z', presion_cabezal: 120 },
        { time: '2026-02-25T10:10:00Z', presion_cabezal: 121 },
      ],
      ['presion_cabezal'],
    );

    expect(payload.table[0]?.time).toBe('2026-02-25T10:10:00.000Z');
    expect(payload.table).toHaveLength(2);
  });
});


