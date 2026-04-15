export interface User {
  id: number;
  name: string;
}

export interface Task {
  id: number;
  column_id: number;
  title: string;
  description: string;
  estimated_hours: number;
  deadline: string;
  assigned_user_id: number | null;
  order_index: number;
  color: string;
}

export interface Column {
  id: number;
  project_id: number;
  title: string;
  order_index: number;
  color: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

// Dummy export to ensure it's not a type-only file
export const TYPES_VERSION = '1.0.0';
