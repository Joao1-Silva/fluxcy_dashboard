'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { KanbanSquare, List, Trash2 } from 'lucide-react';

import { useTaskSync } from '@/hooks/use-task-sync';
import { useTaskStore } from '@/store/tasks-store';
import type { TaskItem, TaskPriority, TaskStatus } from '@/types/tasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const statuses: TaskStatus[] = ['todo', 'doing', 'done'];
const priorities: TaskPriority[] = ['low', 'medium', 'high'];

type TaskBoardProps = {
  compact?: boolean;
};

function priorityVariant(priority: TaskPriority) {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'muted';
}

function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'todo') return 'doing';
  if (status === 'doing') return 'done';
  return 'todo';
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: TaskItem;
  onUpdate: (task: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{task.title}</h4>
          <p className="text-xs text-slate-400">{new Date(task.createdAt).toLocaleString()}</p>
        </div>
        <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
      </div>
      <p className="mb-2 text-sm text-slate-300">{task.description || 'Sin descripción'}</p>
      {task.context ? <p className="mb-2 text-xs text-slate-400">Contexto: {task.context}</p> : null}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {task.tags.map((tag) => (
          <Badge key={`${task.id}-${tag}`} variant="default">
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onUpdate({ ...task, status: nextStatus(task.status) })}
        >
          {task.status} ? {nextStatus(task.status)}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(task.id)} aria-label="Eliminar task">
          <Trash2 className="h-4 w-4 text-rose-300" />
        </Button>
      </div>
    </div>
  );
}

export function TaskBoard({ compact = false }: TaskBoardProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const view = useTaskStore((state) => state.view);
  const setView = useTaskStore((state) => state.setView);
  const createTask = useTaskStore((state) => state.createTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const removeTask = useTaskStore((state) => state.removeTask);

  const sync = useTaskSync();

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    tags: '',
    context: '',
  });

  const grouped = useMemo(
    () =>
      statuses.reduce<Record<TaskStatus, TaskItem[]>>(
        (acc, status) => {
          acc[status] = tasks.filter((task) => task.status === status);
          return acc;
        },
        {
          todo: [],
          doing: [],
          done: [],
        },
      ),
    [tasks],
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      return;
    }

    const task = createTask({
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      context: form.context,
    });

    await sync.createRemote(task);

    setForm({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      tags: '',
      context: '',
    });
  };

  const handleUpdate = async (task: TaskItem) => {
    updateTask(task.id, task);
    await sync.updateRemote(task);
  };

  const handleDelete = async (id: string) => {
    removeTask(id);
    await sync.deleteRemote(id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nueva Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ej: Verificar válvula macolla 3"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="task-description">Descripción</Label>
              <textarea
                id="task-description"
                className="min-h-20 w-full rounded-xl border border-slate-700/70 bg-slate-950/70 p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalle operativo"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className="h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 text-sm text-slate-100"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                  }))
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <select
                className="h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 text-sm text-slate-100"
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Tags (coma)</Label>
              <Input
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="pozo-A, operador, alarma"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contexto</Label>
              <Input
                value={form.context}
                onChange={(event) => setForm((current) => ({ ...current, context: event.target.value }))}
                placeholder="Macolla 1 - 2026-02-26"
              />
            </div>

            <div className="md:col-span-2">
              <Button className="w-full" type="submit">
                Crear Task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Tasks ({tasks.length})</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === 'kanban' ? 'default' : 'secondary'}
            onClick={() => setView('kanban')}
          >
            <KanbanSquare className="mr-1 h-4 w-4" />
            Kanban
          </Button>
          <Button size="sm" variant={view === 'list' ? 'default' : 'secondary'} onClick={() => setView('list')}>
            <List className="mr-1 h-4 w-4" />
            Lista
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
          {statuses.map((status) => (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide">
                  {status} ({grouped[status].length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {grouped[status].length === 0 ? (
                  <p className="text-xs text-slate-500">Sin tasks</p>
                ) : (
                  grouped[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/90 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">Título</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Prioridad</th>
                    <th className="px-2 py-2 text-left">Contexto</th>
                    <th className="px-2 py-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-slate-800/70">
                      <td className="px-2 py-3 text-slate-100">{task.title}</td>
                      <td className="px-2 py-3">
                        <Badge variant="default">{task.status}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                      </td>
                      <td className="px-2 py-3 text-slate-400">{task.context || '--'}</td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleUpdate({ ...task, status: nextStatus(task.status) })}>
                            Mover
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>
                            Borrar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


