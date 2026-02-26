import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { SERVER_CONFIG } from '../lib/config.js';

const router = Router();

type TaskStatus = 'todo' | 'doing' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  context: string;
  createdAt: string;
};

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.enum(['todo', 'doing', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).default([]),
  context: z.string().default(''),
  createdAt: z.string().datetime().optional(),
});

const store = new Map<string, TaskItem>();

function ensureEnabled() {
  return SERVER_CONFIG.enableTasksBackend;
}

router.get('/', (_req, res) => {
  if (!ensureEnabled()) {
    return res.status(404).json({ message: 'Tasks backend deshabilitado por configuracion.' });
  }

  const tasks = Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ tasks });
});

router.post('/', (req, res) => {
  if (!ensureEnabled()) {
    return res.status(404).json({ message: 'Tasks backend deshabilitado por configuracion.' });
  }

  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Payload invalido', errors: parsed.error.flatten() });
  }

  const task: TaskItem = {
    ...parsed.data,
    id: parsed.data.id ?? randomUUID(),
    createdAt: parsed.data.createdAt ?? new Date().toISOString(),
  };

  store.set(task.id, task);
  res.status(201).json({ task });
});

router.put('/:id', (req, res) => {
  if (!ensureEnabled()) {
    return res.status(404).json({ message: 'Tasks backend deshabilitado por configuracion.' });
  }

  const parsed = taskSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    return res.status(400).json({ message: 'Payload invalido', errors: parsed.error.flatten() });
  }

  const current = store.get(req.params.id);
  const task: TaskItem = {
    ...parsed.data,
    id: req.params.id,
    createdAt: parsed.data.createdAt ?? current?.createdAt ?? new Date().toISOString(),
  };

  store.set(task.id, task);
  res.json({ task });
});

router.delete('/:id', (req, res) => {
  if (!ensureEnabled()) {
    return res.status(404).json({ message: 'Tasks backend deshabilitado por configuracion.' });
  }

  store.delete(req.params.id);
  res.status(204).end();
});

export { router as tasksRouter };
