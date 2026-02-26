export type TaskStatus = 'todo' | 'doing' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

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

export type TaskPayload = Omit<TaskItem, 'id' | 'createdAt'> &
  Partial<Pick<TaskItem, 'id' | 'createdAt'>>;


