'use client';

import Link from 'next/link';

import { AuthGuard } from '@/components/auth/auth-guard';
import { TaskBoard } from '@/components/tasks/task-board';
import { Button } from '@/components/ui/button';

export default function TasksPage() {
  return (
    <AuthGuard allowRoles={['superadmin']}>
      <main className="min-h-screen px-3 py-4 sm:px-5 lg:px-8 lg:py-8">
        <div className="glass-panel mb-4 flex items-center justify-between rounded-2xl p-4">
          <div>
            <h1 className="text-xl font-semibold">Tasks</h1>
            <p className="text-xs text-slate-400">Kanban + lista con persistencia localStorage y backend opcional.</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
        <TaskBoard />
      </main>
    </AuthGuard>
  );
}
