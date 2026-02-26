'use client';

import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { fetchJson } from '@/lib/api-client';
import { APP_CONFIG } from '@/lib/app-config';
import { useTaskStore } from '@/store/tasks-store';
import type { TaskItem } from '@/types/tasks';

const backendEnabled = APP_CONFIG.enableTasksBackend;

export function useTaskSync() {
  const replaceTasks = useTaskStore((state) => state.replaceTasks);

  useEffect(() => {
    if (!backendEnabled) {
      return;
    }

    let mounted = true;

    void fetchJson<{ tasks: TaskItem[] }>('/api/tasks')
      .then((result) => {
        if (mounted) {
          replaceTasks(result.tasks);
        }
      })
      .catch((error: Error) => {
        toast.error(`No fue posible hidratar tasks desde backend: ${error.message}`);
      });

    return () => {
      mounted = false;
    };
  }, [replaceTasks]);

  return useMemo(
    () => ({
      enabled: backendEnabled,
      createRemote: async (task: TaskItem) => {
        if (!backendEnabled) {
          return;
        }
        try {
          await fetchJson('/api/tasks', {
            method: 'POST',
            body: task,
          });
        } catch (error) {
          toast.error(`Error al guardar task remota: ${(error as Error).message}`);
        }
      },
      updateRemote: async (task: TaskItem) => {
        if (!backendEnabled) {
          return;
        }
        try {
          await fetchJson(`/api/tasks/${task.id}`, {
            method: 'PUT',
            body: task,
          });
        } catch (error) {
          toast.error(`Error al actualizar task remota: ${(error as Error).message}`);
        }
      },
      deleteRemote: async (id: string) => {
        if (!backendEnabled) {
          return;
        }
        try {
          await fetchJson(`/api/tasks/${id}`, {
            method: 'DELETE',
          });
        } catch (error) {
          toast.error(`Error al borrar task remota: ${(error as Error).message}`);
        }
      },
    }),
    [],
  );
}
