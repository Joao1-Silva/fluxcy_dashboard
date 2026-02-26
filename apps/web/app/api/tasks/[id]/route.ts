import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getTask,
  removeTask,
  saveTask,
  tasksBackendEnabled,
  validateTaskPayload,
} from '@/lib/bff/tasks-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParamsContext = {
  params: { id: string } | Promise<{ id: string }>;
};

function disabledResponse() {
  return NextResponse.json({ message: 'Tasks backend deshabilitado por configuracion.' }, { status: 404 });
}

async function getId(context: ParamsContext) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function PUT(request: NextRequest, context: ParamsContext) {
  if (!tasksBackendEnabled()) {
    return disabledResponse();
  }

  const id = await getId(context);
  if (!id) {
    return NextResponse.json({ message: 'Task id requerido' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const current = getTask(id);
    const task = validateTaskPayload(payload, id, current?.createdAt);
    if (!task) {
      return NextResponse.json({ message: 'Payload invalido' }, { status: 400 });
    }

    saveTask(task);
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: ParamsContext) {
  if (!tasksBackendEnabled()) {
    return disabledResponse();
  }

  const id = await getId(context);
  if (!id) {
    return NextResponse.json({ message: 'Task id requerido' }, { status: 400 });
  }

  removeTask(id);
  return new NextResponse(null, { status: 204 });
}
