import { describe, expect, it } from 'vitest';

import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@/lib/time';

describe('time mapping', () => {
  it('converts local datetime to ISO and back', () => {
    const localValue = '2026-02-26T10:30';
    const iso = fromDateTimeLocalInput(localValue);

    expect(iso).toContain('2026-02-26T');
    expect(toDateTimeLocalInput(iso)).toBe(localValue);
  });
});
