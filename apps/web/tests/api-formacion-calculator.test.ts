import { describe, expect, it } from 'vitest';

import {
  calculateApiFormacion,
  PHYSICAL_VALIDITY_ERROR_MESSAGE,
} from '@/lib/api-formacion-calculator';

describe('api formacion calculator', () => {
  it('calcula api de formacion con entradas validas', () => {
    const result = calculateApiFormacion({
      volumenFormacion: 100,
      volumenDiluente: 20,
      apiMezcla: 30,
      apiDiluente: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Number.isFinite(result.result.apiFormacion)).toBe(true);
    expect(result.result.intermedios.volumenMezcla).toBe(120);
    expect(result.result.intermedios.sgApiMezcla).toBeCloseTo(0.87616, 5);
    expect(result.result.intermedios.sgApiDiluente).toBeCloseTo(0.77961, 5);
    expect(result.result.intermedios.denominador).toBeGreaterThan(0);
  });

  it('falla cuando Vf es 0', () => {
    const result = calculateApiFormacion({
      volumenFormacion: 0,
      volumenDiluente: 10,
      apiMezcla: 20,
      apiDiluente: 35,
    });

    expect(result.ok).toBe(false);
  });

  it('falla cuando el denominador es menor o igual a 0', () => {
    const result = calculateApiFormacion({
      volumenFormacion: 1,
      volumenDiluente: 10,
      apiMezcla: 80,
      apiDiluente: 0,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.message).toBe(PHYSICAL_VALIDITY_ERROR_MESSAGE);
  });
});
