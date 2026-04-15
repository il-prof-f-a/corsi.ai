export type Project = {
  id: number;
  name: string;
  description: string;
  color: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: number;
  name: string;
  email: string | null;
  avatar_color: string;
  created_at: string;
};

export type Assignee = {
  id: number;
  name: string;
  avatarColor: string;
};

export type TaskSummary = {
  id: number;
  title: string;
  description: string;
  priority: string;
  color: string;
  position: number;
  estimatedMinutes: number;
  actualSeconds: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: Assignee[];
  commentCount: number;
  attachmentCount: number;
  hasActiveTimer: boolean;
  activeTimerStartedAt: string | null;
  activeTimerElapsedSeconds: number;
};

export type BoardColumn = {
  id: number;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  tasks: TaskSummary[];
};

export type BoardData = {
  project: {
    id: number;
    name: string;
    description: string;
    color: string;
    createdAt: string;
    updatedAt: string;
  };
  columns: BoardColumn[];
};

export type TaskComment = {
  id: number;
  taskId: number;
  userId: number | null;
  content: string;
  createdAt: string;
  userName: string | null;
  userColor: string | null;
};

export type TaskAttachment = {
  id: number;
  taskId: number;
  originalName: string;
  storedName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
  url: string;
};

export type TaskDetail = {
  id: number;
  projectId: number;
  columnId: number;
  title: string;
  description: string;
  priority: string;
  color: string;
  estimatedMinutes: number;
  actualSeconds: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: Array<{
    id: number;
    name: string;
    email: string | null;
    avatarColor: string;
  }>;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activeTimerStartedAt: string | null;
  activeTimerElapsedSeconds: number;
};
