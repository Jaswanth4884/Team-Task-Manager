export type Role = 'admin' | 'member';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  dueDate: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseState {
  users: User[];
  sessions: Session[];
  projects: Project[];
  tasks: Task[];
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface PublicTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
}

export interface PublicProject {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  dueDate: string;
  memberCount: number;
  taskCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
}