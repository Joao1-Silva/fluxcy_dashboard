import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { listTasks, saveTask, tasksBackendEnabled, validateTaskPayload } from '@/lib/bff/tasks-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function disabledResponse() {
  return NextResponse.json({ message: 'Tasks backend deshabilitado por configuracion.' }, { status: 404 });
}

export async function GET() {
  if (!tasksBackendEnabled()) {
    return disabledResponse();
  }

  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: NextRequest) {
  if (!tasksBackendEnabled()) {
    return disabledResponse();
  }

  try {
    const payload = await request.json();
    const task = validateTaskPayload(payload);
    if (!task) {
      return NextResponse.json({ message: 'Payload invalido' }, { status: 400 });
    }

    saveTask(task);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
