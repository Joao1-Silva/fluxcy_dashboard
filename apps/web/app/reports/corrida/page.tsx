'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AuthGuard } from '@/components/auth/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_PROFILE_OVERRIDE_STORAGE_KEY, normalizeApiProfile } from '@/lib/api-profile';

const MAX_RANGE_MS = 12 * 60 * 60 * 1000;
const SUGGESTED_STEP_SECONDS = 1200;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ensureSeconds(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

function downloadBuffer(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function CorridaReportsPage() {
  const now = useMemo(() => new Date(), []);
  const initialEnd = toLocalInputValue(now);
  const initialStart = toLocalInputValue(new Date(now.getTime() - 2 * 60 * 60 * 1000));

  const [fechaInicio, setFechaInicio] = useState(initialStart);
  const [fechaFin, setFechaFin] = useState(initialEnd);

  const [modalOpen, setModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [pozo, setPozo] = useState('');
  const [macolla, setMacolla] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rangeValidation = useMemo(() => {
    const from = parseDate(fechaInicio);
    const to = parseDate(fechaFin);
    if (!from || !to) {
      return { ok: false, message: 'Debes seleccionar fecha/hora valida.' };
    }
    if (to.getTime() <= from.getTime()) {
      return { ok: false, message: 'fechaFin debe ser mayor que fechaInicio.' };
    }
    const delta = to.getTime() - from.getTime();
    if (delta > MAX_RANGE_MS) {
      return { ok: false, message: 'El rango maximo permitido es 12 horas.' };
    }
    return { ok: true as const };
  }, [fechaInicio, fechaFin]);

  const openModal = () => {
    if (!rangeValidation.ok) {
      toast.error(rangeValidation.message);
      return;
    }
    setModalOpen(true);
  };

  const generateReport = async () => {
    if (!rangeValidation.ok) {
      toast.error(rangeValidation.message);
      return;
    }

    const cleanFileName = fileName.replace(/\.xlsx$/i, '').trim();
    if (!cleanFileName || !pozo.trim() || !macolla.trim()) {
      toast.error('fileName, pozo y macolla son obligatorios.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedProfile =
        typeof window === 'undefined'
          ? 'DEFAULT'
          : normalizeApiProfile(window.localStorage.getItem(API_PROFILE_OVERRIDE_STORAGE_KEY));

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(selectedProfile === 'WELLTECH' ? { 'x-api-profile': 'WELLTECH' } : {}),
        },
        body: JSON.stringify({
          fechaInicio: ensureSeconds(fechaInicio),
          fechaFin: ensureSeconds(fechaFin),
          pozo: pozo.trim(),
          macolla: macolla.trim(),
          fileName: cleanFileName,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        const message = parseApiError(payload) ?? 'No fue posible generar el reporte.';
        if (response.status === 403 && message.toLowerCase().includes('finalizo su prueba')) {
          window.location.href = '/login?expired=1';
          return;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      downloadBuffer(blob, cleanFileName);
      toast.success('Reporte generado correctamente.');
      setModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">Reporte de Corrida (Excel)</h1>
              <p className="text-sm text-slate-400">
                Rango maximo: 12h. Paso sugerido: 20 min. Timezone de salida: America/New_York.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" asChild>
                <Link href="/dashboard">Volver a dashboard</Link>
              </Button>
            </div>
          </div>

          <Card className="glass-panel">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4" />
                  Generador VDF
                </CardTitle>
                <CardDescription>
                  Selecciona el rango, valida, y luego confirma nombre de archivo, pozo y macolla.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fechaInicio">Fecha inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="datetime-local"
                    step={SUGGESTED_STEP_SECONDS}
                    value={fechaInicio}
                    onChange={(event) => setFechaInicio(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fechaFin">Fecha fin</Label>
                  <Input
                    id="fechaFin"
                    type="datetime-local"
                    step={SUGGESTED_STEP_SECONDS}
                    value={fechaFin}
                    onChange={(event) => setFechaFin(event.target.value)}
                  />
                </div>
              </div>

              {!rangeValidation.ok ? (
                <p className="text-sm text-rose-300">{rangeValidation.message}</p>
              ) : (
                <p className="text-sm text-emerald-300">Rango valido para generar reporte.</p>
              )}

              <Button className="w-full sm:w-auto" onClick={openModal} disabled={!rangeValidation.ok}>
                <Download className="mr-1.5 h-4 w-4" />
                Generar reporte
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-400/30 bg-slate-950/95 p-5 shadow-2xl">
              <Dialog.Title className="text-base font-semibold text-slate-100">Confirmar parametros</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-400">
                Completa los campos obligatorios antes de generar.
              </Dialog.Description>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fileName">Nombre archivo (sin extension)</Label>
                  <Input
                    id="fileName"
                    placeholder="Reporte_FLUXCY_H1B_P01_2026-02-27"
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pozo">Pozo</Label>
                  <Input
                    id="pozo"
                    placeholder="H1B P01"
                    value={pozo}
                    onChange={(event) => setPozo(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="macolla">Macolla</Label>
                  <Input
                    id="macolla"
                    placeholder="H1B"
                    value={macolla}
                    onChange={(event) => setMacolla(event.target.value)}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="secondary" type="button" disabled={submitting}>
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button type="button" onClick={generateReport} disabled={submitting}>
                  {submitting ? 'Generando...' : 'Confirmar y generar'}
                </Button>
              </div>

              <Dialog.Close className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100">
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </AuthGuard>
  );
}
