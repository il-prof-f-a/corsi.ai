import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
export const dataDir = path.join(appRoot, 'data');
export const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
export const dbPath = path.join(dataDir, 'app.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
export const defaultColumns = [
    { name: 'TODO', color: '#2563eb' },
    { name: 'IN WORKING', color: '#f59e0b' },
    { name: 'DONE', color: '#16a34a' },
];
export function nowIso() {
    return new Date().toISOString();
}
export function clampInt(value, fallback = 0) {
    if (value === null || value === undefined || value === '')
        return fallback;
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(0, Math.round(n));
}
export function parseId(value, name) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0)
        throw new Error(`Parametro '${name}' non valido`);
    return id;
}
export function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#0ea5e9',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      avatar_color TEXT DEFAULT '#64748b',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT DEFAULT '#334155',
      is_default INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      column_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'media',
      color TEXT DEFAULT '#22c55e',
      position INTEGER NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      actual_seconds INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY(task_id, user_id),
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS timer_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_columns_project_position ON columns(project_id, position);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_column_position ON tasks(project_id, column_id, position);
  `);
}
export function seedUsers() {
    const count = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (count.count > 0)
        return;
    const insert = db.prepare('INSERT INTO users (name, email, avatar_color, created_at) VALUES (?, ?, ?, ?)');
    const now = nowIso();
    insert.run('Tu', null, '#0f766e', now);
    insert.run('Collaboratore A', null, '#7c3aed', now);
    insert.run('Collaboratore B', null, '#be185d', now);
}
export function ensureProject(projectId) {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!row)
        throw Object.assign(new Error('Progetto non trovato'), { status: 404 });
}
export function ensureColumn(columnId) {
    const row = db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);
    if (!row)
        throw Object.assign(new Error('Colonna non trovata'), { status: 404 });
    return row;
}
export function ensureTask(taskId) {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!row)
        throw Object.assign(new Error('Task non trovata'), { status: 404 });
    return row;
}
export function normalizeColumnOrder(projectId) {
    const rows = db
        .prepare('SELECT id FROM columns WHERE project_id = ? ORDER BY position ASC, id ASC')
        .all(projectId);
    const upd = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
    rows.forEach((row, i) => upd.run(i, row.id));
}
export function normalizeTaskOrder(columnId) {
    const rows = db
        .prepare('SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC, id ASC')
        .all(columnId);
    const upd = db.prepare('UPDATE tasks SET position = ? WHERE id = ?');
    rows.forEach((row, i) => upd.run(i, row.id));
}
