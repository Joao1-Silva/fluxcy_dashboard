import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { generateCorridaReport, ReportGenerationError } from '@/lib/reports/corrida-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GenerateReportBody = {
  fechaInicio: string;
  fechaFin: string;
  pozo: string;
  macolla: string;
  fileName: string;
};

function asRequiredString(value: unknown, key: keyof GenerateReportBody): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReportGenerationError(400, `${key} es obligatorio.`);
  }
  return value.trim();
}

function parseBody(payload: unknown): GenerateReportBody {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ReportGenerationError(400, 'Body invalido.');
  }

  const body = payload as Record<string, unknown>;
  return {
    fechaInicio: asRequiredString(body.fechaInicio, 'fechaInicio'),
    fechaFin: asRequiredString(body.fechaFin, 'fechaFin'),
    pozo: asRequiredString(body.pozo, 'pozo'),
    macolla: asRequiredString(body.macolla, 'macolla'),
    fileName: asRequiredString(body.fileName, 'fileName'),
  };
}

function contentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(`${fileName}.xlsx`);
  return `attachment; filename="${fileName}.xlsx"; filename*=UTF-8''${encoded}`;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let body: GenerateReportBody;

  try {
    body = parseBody(await request.json());
  } catch (error) {
    if (error instanceof ReportGenerationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Body invalido.' }, { status: 400 });
  }

  try {
    const report = await generateCorridaReport({
      ...body,
      requestId,
    });

    return new NextResponse(new Uint8Array(report.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': contentDisposition(report.fileName),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ReportGenerationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message.includes('Finalizo su prueba')) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error(`[reports][${requestId}]`, message);
    return NextResponse.json({ message: 'No fue posible generar el reporte.' }, { status: 500 });
  }
}
