import { randomUUID } from 'node:crypto';

type TaskStatus = 'todo' | 'doing' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  context: string;
  createdAt: string;
};

type TaskInput = Partial<TaskItem> & {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  tags?: unknown;
  context?: unknown;
  createdAt?: unknown;
};

const store = new Map<string, TaskItem>();

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

export function tasksBackendEnabled() {
  return (
    toBoolean(process.env.ENABLE_TASKS_BACKEND, false) ||
    toBoolean(process.env.NEXT_PUBLIC_ENABLE_TASKS_BACKEND, false)
  );
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function asStatus(value: unknown): TaskStatus {
  if (value === 'todo' || value === 'doing' || value === 'done') {
    return value;
  }
  return 'todo';
}

function asPriority(value: unknown): TaskPriority {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'medium';
}

function asDate(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString();
}

export function validateTaskPayload(input: unknown, id?: string, currentCreatedAt?: string): TaskItem | null {
  const payload = (input ?? {}) as TaskInput;
  const title = asString(payload.title, '').trim();
  if (title.length === 0) {
    return null;
  }

  return {
    id: id ?? (typeof payload.id === 'string' ? payload.id : randomUUID()),
    title,
    description: asString(payload.description, ''),
    status: asStatus(payload.status),
    priority: asPriority(payload.priority),
    tags: asStringArray(payload.tags),
    context: asString(payload.context, ''),
    createdAt: asDate(payload.createdAt, currentCreatedAt ?? new Date().toISOString()),
  };
}

export function listTasks() {
  return Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTask(id: string) {
  return store.get(id);
}

export function saveTask(task: TaskItem) {
  store.set(task.id, task);
}

export function removeTask(id: string) {
  store.delete(id);
}
