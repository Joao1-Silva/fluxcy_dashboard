'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  calculateApiFormacion,
  type ApiFormacionCalculationOutcome,
} from '@/lib/api-formacion-calculator';

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
}

function formatFixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatVolume(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function ApiFormacionMassBalanceCalculator() {
  const [volumenFormacion, setVolumenFormacion] = useState('');
  const [volumenDiluente, setVolumenDiluente] = useState('');
  const [apiMezcla, setApiMezcla] = useState('');
  const [apiDiluente, setApiDiluente] = useState('');
  const [calculation, setCalculation] = useState<ApiFormacionCalculationOutcome | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance de Masa – API de Formación</CardTitle>
        <CardDescription>
          Calculadora para estimar API de formación con balance de masa. Usa la misma unidad para Vf y Vd.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();

            setCalculation(
              calculateApiFormacion({
                volumenFormacion: parseDecimalInput(volumenFormacion),
                volumenDiluente: parseDecimalInput(volumenDiluente),
                apiMezcla: parseDecimalInput(apiMezcla),
                apiDiluente: parseDecimalInput(apiDiluente),
              }),
            );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="api-formacion-vf">Volumen de Formación (Vf)</Label>
              <Input
                id="api-formacion-vf"
                inputMode="decimal"
                value={volumenFormacion}
                onChange={(event) => setVolumenFormacion(event.target.value)}
                placeholder="Ej: 1200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-formacion-vd">Volumen de Diluente Inyectado (Vd)</Label>
              <Input
                id="api-formacion-vd"
                inputMode="decimal"
                value={volumenDiluente}
                onChange={(event) => setVolumenDiluente(event.target.value)}
                placeholder="Ej: 0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-formacion-api-mix">API de Mezcla (ApiMix)</Label>
              <Input
                id="api-formacion-api-mix"
                inputMode="decimal"
                value={apiMezcla}
                onChange={(event) => setApiMezcla(event.target.value)}
                placeholder="Ej: 28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-formacion-api-dil">API de Diluente (ApiDil)</Label>
              <Input
                id="api-formacion-api-dil"
                inputMode="decimal"
                value={apiDiluente}
                onChange={(event) => setApiDiluente(event.target.value)}
                placeholder="Ej: 42"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Calcular
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setVolumenFormacion('');
                setVolumenDiluente('');
                setApiMezcla('');
                setApiDiluente('');
                setCalculation(null);
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>

        {calculation ? (
          calculation.ok ? (
            <div className="space-y-3 rounded-xl border border-sky-400/30 bg-slate-900/70 p-3">
              <p className="text-sm text-slate-200">
                API de Formación calculado:{' '}
                <span className="text-lg font-semibold text-sky-300">
                  {formatFixed(calculation.result.apiFormacion, 2)} °API
                </span>
              </p>

              {calculation.result.warnings.length > 0 ? (
                <ul className="space-y-1 text-sm text-amber-300">
                  {calculation.result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}

              <details className="rounded-lg border border-slate-700/70 p-2 text-sm text-slate-300">
                <summary className="cursor-pointer select-none">Ver intermedios de auditoría</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p>
                    Vmix:{' '}
                    <span className="font-semibold text-slate-100">
                      {formatVolume(calculation.result.intermedios.volumenMezcla)}
                    </span>
                  </p>
                  <p>
                    SG(ApiMix):{' '}
                    <span className="font-semibold text-slate-100">
                      {formatFixed(calculation.result.intermedios.sgApiMezcla, 5)}
                    </span>
                  </p>
                  <p>
                    SG(ApiDil):{' '}
                    <span className="font-semibold text-slate-100">
                      {formatFixed(calculation.result.intermedios.sgApiDiluente, 5)}
                    </span>
                  </p>
                  <p>
                    Denominador D:{' '}
                    <span className="font-semibold text-slate-100">
                      {formatFixed(calculation.result.intermedios.denominador, 5)}
                    </span>
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200"
            >
              {calculation.message}
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
