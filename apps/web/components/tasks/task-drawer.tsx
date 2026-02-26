'use client';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTaskStore } from '@/store/tasks-store';

import { TaskBoard } from './task-board';

export function TaskDrawer() {
  const drawerOpen = useTaskStore((state) => state.drawerOpen);
  const setDrawerOpen = useTaskStore((state) => state.setDrawerOpen);

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Task List</SheetTitle>
          <SheetDescription>Secuencia operativa local con persistencia y backend opcional.</SheetDescription>
        </SheetHeader>
        <div className="max-h-[92vh] overflow-y-auto pr-1">
          <TaskBoard compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}


