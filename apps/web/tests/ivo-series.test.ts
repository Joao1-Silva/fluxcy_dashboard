import { describe, expect, it } from 'vitest';

import { extractIvoRange } from '@/lib/ivo-series';

describe('ivo series', () => {
  it('usa vliq del primer y ultimo punto', () => {
    const result = extractIvoRange([
      { t: '2026-02-26T10:01:00.000Z', vliq: 140 },
      { t: '2026-02-26T10:00:00.000Z', vliq: 100 },
      { t: '2026-02-26T10:02:00.000Z', vliq: 160 },
    ]);

    expect(result).toEqual({ ivoFrom: 100, ivoTo: 160 });
  });

  it('hace fallback a totalliq o liq_acum', () => {
    const result = extractIvoRange([
      { t: '2026-02-26T10:00:00.000Z', totalliq: '200.5' },
      { t: '2026-02-26T10:05:00.000Z', liq_acum: 220.25 },
    ]);

    expect(result).toEqual({ ivoFrom: 200.5, ivoTo: 220.25 });
  });

  it('retorna null si no hay valores numericos', () => {
    const result = extractIvoRange([
      { t: '2026-02-26T10:00:00.000Z', vliq: null },
      { t: '2026-02-26T10:05:00.000Z', vliq: 'no-number' },
    ]);

    expect(result).toBeNull();
  });
});
