export type ApiFormacionInput = {
  volumenFormacion: number;
  volumenDiluente: number;
  apiMezcla: number;
  apiDiluente: number;
};

export type ApiFormacionIntermedios = {
  volumenMezcla: number;
  sgApiMezcla: number;
  sgApiDiluente: number;
  denominador: number;
};

export type ApiFormacionResult = {
  apiFormacion: number;
  intermedios: ApiFormacionIntermedios;
  warnings: string[];
};

export type ApiFormacionCalculationOutcome =
  | {
      ok: true;
      result: ApiFormacionResult;
    }
  | {
      ok: false;
      message: string;
    };

const MIN_API = -131.5;
const RANGE_WARNING_MIN = 0;
const RANGE_WARNING_MAX = 80;
export const PHYSICAL_VALIDITY_ERROR_MESSAGE =
  'Entradas inconsistentes: el cálculo no es físicamente válido';

export function apiToSpecificGravity(api: number): number {
  return 141.5 / (api + 131.5);
}

export function calculateApiFormacion(input: ApiFormacionInput): ApiFormacionCalculationOutcome {
  const { volumenFormacion, volumenDiluente, apiMezcla, apiDiluente } = input;

  if (
    !Number.isFinite(volumenFormacion) ||
    !Number.isFinite(volumenDiluente) ||
    !Number.isFinite(apiMezcla) ||
    !Number.isFinite(apiDiluente)
  ) {
    return {
      ok: false,
      message: 'Todos los campos deben ser numericos.',
    };
  }

  if (volumenFormacion <= 0) {
    return {
      ok: false,
      message: 'Volumen de Formacion (Vf) debe ser mayor a 0.',
    };
  }

  if (volumenDiluente < 0) {
    return {
      ok: false,
      message: 'Volumen de Diluente Inyectado (Vd) no puede ser negativo.',
    };
  }

  if (apiMezcla <= MIN_API || apiDiluente <= MIN_API) {
    return {
      ok: false,
      message: `API de Mezcla y API de Diluente deben ser mayores a ${MIN_API}.`,
    };
  }

  const volumenMezcla = volumenFormacion + volumenDiluente;
  if (!(volumenMezcla > 0)) {
    return {
      ok: false,
      message: 'Volumen de mezcla (Vmix) debe ser mayor a 0.',
    };
  }

  const sgApiMezcla = apiToSpecificGravity(apiMezcla);
  const sgApiDiluente = apiToSpecificGravity(apiDiluente);

  const denominador =
    (volumenMezcla / volumenFormacion) * sgApiMezcla -
    (volumenDiluente / volumenFormacion) * sgApiDiluente;

  if (!Number.isFinite(denominador) || denominador <= 0) {
    return {
      ok: false,
      message: PHYSICAL_VALIDITY_ERROR_MESSAGE,
    };
  }

  const apiFormacion = 141.5 / denominador - 131.5;
  if (!Number.isFinite(apiFormacion)) {
    return {
      ok: false,
      message: PHYSICAL_VALIDITY_ERROR_MESSAGE,
    };
  }

  const warnings: string[] = [];

  if (apiMezcla < RANGE_WARNING_MIN || apiMezcla > RANGE_WARNING_MAX) {
    warnings.push('API de Mezcla fuera del rango tipico 0-80.');
  }

  if (apiDiluente < RANGE_WARNING_MIN || apiDiluente > RANGE_WARNING_MAX) {
    warnings.push('API de Diluente fuera del rango tipico 0-80.');
  }

  return {
    ok: true,
    result: {
      apiFormacion,
      intermedios: {
        volumenMezcla,
        sgApiMezcla,
        sgApiDiluente,
        denominador,
      },
      warnings,
    },
  };
}
