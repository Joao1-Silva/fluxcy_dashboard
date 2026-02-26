'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { TaskItem, TaskPayload, TaskStatus } from '@/types/tasks';

type TaskState = {
  tasks: TaskItem[];
  drawerOpen: boolean;
  view: 'kanban' | 'list';
  setDrawerOpen: (open: boolean) => void;
  setView: (view: 'kanban' | 'list') => void;
  replaceTasks: (tasks: TaskItem[]) => void;
  createTask: (payload: TaskPayload) => TaskItem;
  updateTask: (id: string, payload: Partial<TaskItem>) => void;
  removeTask: (id: string) => void;
  byStatus: (status: TaskStatus) => TaskItem[];
};

function sortByDate(tasks: TaskItem[]) {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      drawerOpen: false,
      view: 'kanban',
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      setView: (view) => set({ view }),
      replaceTasks: (tasks) => set({ tasks: sortByDate(tasks) }),
      createTask: (payload) => {
        const task: TaskItem = {
          id: payload.id ?? crypto.randomUUID(),
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          tags: payload.tags,
          context: payload.context,
          createdAt: payload.createdAt ?? new Date().toISOString(),
        };

        set((state) => ({ tasks: sortByDate([task, ...state.tasks]) }));
        return task;
      },
      updateTask: (id, payload) => {
        set((state) => ({
          tasks: sortByDate(
            state.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    ...payload,
                    id,
                  }
                : task,
            ),
          ),
        }));
      },
      removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
      byStatus: (status) => get().tasks.filter((task) => task.status === status),
    }),
    {
      name: 'fluxcy-task-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tasks: state.tasks, view: state.view }),
    },
  ),
);


