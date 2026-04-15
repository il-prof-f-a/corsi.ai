import type { BoardData, Project, TaskDetail, User } from './types';

const API_BASE = '/api';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Errore HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<Project[]>('/projects'),
  createProject: (input: { name: string; description?: string; color?: string }) =>
    request('/projects', { method: 'POST', body: input }),
  listUsers: () => request<User[]>('/users'),
  createUser: (input: { name: string; email?: string | null; avatarColor?: string }) =>
    request('/users', { method: 'POST', body: input }),
  updateUser: (userId: number, input: { name: string; email?: string | null; avatarColor?: string }) =>
    request(`/users/${userId}`, { method: 'PUT', body: input }),
  deleteUser: (userId: number) => request(`/users/${userId}`, { method: 'DELETE' }),
  getBoard: (projectId: number) => request<BoardData>(`/projects/${projectId}/board`),
  createColumn: (projectId: number, input: { name: string; color?: string }) =>
    request(`/projects/${projectId}/columns`, { method: 'POST', body: input }),
  updateColumn: (columnId: number, input: { name: string; color?: string }) =>
    request(`/columns/${columnId}`, { method: 'PUT', body: input }),
  deleteColumn: (columnId: number, moveToColumnId?: number) =>
    request(`/columns/${columnId}${moveToColumnId ? `?moveToColumnId=${moveToColumnId}` : ''}`, {
      method: 'DELETE',
    }),
  reorderColumns: (projectId: number, columnIds: number[]) =>
    request(`/projects/${projectId}/columns/reorder`, {
      method: 'PATCH',
      body: { columnIds },
    }),
  createTask: (input: {
    projectId: number;
    columnId: number;
    title: string;
    description?: string;
    priority?: string;
    color?: string;
    estimatedMinutes?: number;
    actualMinutes?: number;
    startDate?: string | null;
    dueDate?: string | null;
    userIds?: number[];
  }) => request('/tasks', { method: 'POST', body: input }),
  updateTask: (
    taskId: number,
    input: {
      title: string;
      description?: string;
      priority?: string;
      color?: string;
      estimatedMinutes?: number;
      actualMinutes?: number;
      startDate?: string | null;
      dueDate?: string | null;
    },
  ) => request(`/tasks/${taskId}`, { method: 'PUT', body: input }),
  deleteTask: (taskId: number) => request(`/tasks/${taskId}`, { method: 'DELETE' }),
  moveTask: (taskId: number, toColumnId: number, toPosition?: number) =>
    request(`/tasks/${taskId}/move`, {
      method: 'PATCH',
      body: { toColumnId, toPosition },
    }),
  reorderTask: (taskId: number, direction: 'up' | 'down') =>
    request(`/tasks/${taskId}/reorder`, { method: 'PATCH', body: { direction } }),
  setTaskAssignees: (taskId: number, userIds: number[]) =>
    request(`/tasks/${taskId}/assignees`, { method: 'PATCH', body: { userIds } }),
  getTask: (taskId: number) => request<TaskDetail>(`/tasks/${taskId}`),
  addComment: (taskId: number, content: string, userId: number | null) =>
    request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { content, userId },
    }),
  deleteComment: (commentId: number) => request(`/comments/${commentId}`, { method: 'DELETE' }),
  uploadAttachment: async (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Errore HTTP ${response.status}`);
    }
    return response.json();
  },
  deleteAttachment: (attachmentId: number) => request(`/attachments/${attachmentId}`, { method: 'DELETE' }),
  startTimer: (taskId: number) => request(`/tasks/${taskId}/timer/start`, { method: 'POST' }),
  stopTimer: (taskId: number) => request(`/tasks/${taskId}/timer/stop`, { method: 'POST' }),
};
