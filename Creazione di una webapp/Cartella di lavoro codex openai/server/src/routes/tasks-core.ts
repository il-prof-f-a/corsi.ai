import { Router } from 'express';
import {
  clampInt,
  db,
  ensureColumn,
  ensureProject,
  ensureTask,
  normalizeTaskOrder,
  nowIso,
  parseId,
} from '../db.js';
import { moveTaskTx } from '../board.js';

export const tasksCoreRouter = Router();

tasksCoreRouter.post('/tasks', (req, res) => {
  const projectId = Number(req.body?.projectId);
  const columnId = Number(req.body?.columnId);
  if (!Number.isInteger(projectId) || !Number.isInteger(columnId)) {
    return res.status(400).json({ error: 'projectId e columnId sono obbligatori' });
  }
  ensureProject(projectId);
  const column = ensureColumn(columnId);
  if (column.project_id !== projectId) {
    return res.status(400).json({ error: 'La colonna non appartiene al progetto indicato' });
  }

  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Il titolo della task e obbligatorio' });
  const description = String(req.body?.description ?? '').trim();
  const priority = String(req.body?.priority ?? 'media').trim() || 'media';
  const color = String(req.body?.color ?? '#22c55e').trim() || '#22c55e';
  const estimatedMinutes = clampInt(req.body?.estimatedMinutes, 0);
  const actualMinutes = clampInt(req.body?.actualMinutes, 0);
  const startDate = req.body?.startDate ? String(req.body.startDate) : null;
  const dueDate = req.body?.dueDate ? String(req.body.dueDate) : null;
  const userIds: number[] = Array.isArray(req.body?.userIds)
    ? req.body.userIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
    : [];

  const max = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM tasks WHERE column_id = ?')
    .get(columnId) as { maxPos: number };
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO tasks (
        project_id, column_id, title, description, priority, color, position,
        estimated_minutes, actual_seconds, start_date, due_date, completed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      projectId,
      columnId,
      title,
      description,
      priority,
      color,
      max.maxPos + 1,
      estimatedMinutes,
      actualMinutes * 60,
      startDate,
      dueDate,
      column.name.trim().toUpperCase() === 'DONE' ? now : null,
      now,
      now,
    );
  if (userIds.length) {
    const ins = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)');
    userIds.forEach((id) => ins.run(result.lastInsertRowid, id));
  }
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

tasksCoreRouter.put('/tasks/:taskId', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!row) return res.status(404).json({ error: 'Task non trovata' });

  const title = String(req.body?.title ?? row.title).trim();
  if (!title) return res.status(400).json({ error: 'Il titolo della task e obbligatorio' });
  const description = String(req.body?.description ?? row.description).trim();
  const priority = String(req.body?.priority ?? row.priority).trim() || row.priority;
  const color = String(req.body?.color ?? row.color).trim() || row.color;
  const estimatedMinutes = clampInt(req.body?.estimatedMinutes, row.estimated_minutes);
  const actualMinutes = clampInt(req.body?.actualMinutes, Math.round(row.actual_seconds / 60));
  const startDate = req.body?.startDate !== undefined ? (req.body.startDate ? String(req.body.startDate) : null) : row.start_date;
  const dueDate = req.body?.dueDate !== undefined ? (req.body.dueDate ? String(req.body.dueDate) : null) : row.due_date;

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, priority = ?, color = ?, estimated_minutes = ?,
         actual_seconds = ?, start_date = ?, due_date = ?, updated_at = ?
     WHERE id = ?`,
  ).run(title, description, priority, color, estimatedMinutes, actualMinutes * 60, startDate, dueDate, nowIso(), taskId);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), row.project_id);
  res.json({ ok: true });
});

tasksCoreRouter.delete('/tasks/:taskId', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const task = ensureTask(taskId);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    normalizeTaskOrder(task.column_id);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  });
  tx();
  res.status(204).send();
});

tasksCoreRouter.patch('/tasks/:taskId/move', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const toColumnId = Number(req.body?.toColumnId);
  if (!Number.isInteger(toColumnId)) return res.status(400).json({ error: 'toColumnId obbligatorio' });
  const task = ensureTask(taskId);
  moveTaskTx(taskId, toColumnId, req.body?.toPosition);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.json({ ok: true });
});

tasksCoreRouter.patch('/tasks/:taskId/reorder', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const direction = String(req.body?.direction ?? '').toLowerCase();
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'direction deve essere up o down' });
  }
  const task = ensureTask(taskId);
  const neighbor = db
    .prepare(
      direction === 'up'
        ? 'SELECT id, position FROM tasks WHERE column_id = ? AND position < ? ORDER BY position DESC LIMIT 1'
        : 'SELECT id, position FROM tasks WHERE column_id = ? AND position > ? ORDER BY position ASC LIMIT 1',
    )
    .get(task.column_id, task.position) as { id: number; position: number } | undefined;
  if (!neighbor) return res.json({ ok: true });

  const tx = db.transaction(() => {
    db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(neighbor.position, task.id);
    db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(task.position, neighbor.id);
    db.prepare('UPDATE tasks SET updated_at = ? WHERE id IN (?, ?)').run(nowIso(), task.id, neighbor.id);
  });
  tx();
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.json({ ok: true });
});

tasksCoreRouter.patch('/tasks/:taskId/assignees', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const task = ensureTask(taskId);
  const userIds: number[] = Array.isArray(req.body?.userIds)
    ? Array.from(
        new Set(
          (req.body.userIds as unknown[])
            .map((id: unknown) => Number(id))
            .filter((n: number) => Number.isInteger(n) && n > 0),
        ),
      )
    : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM task_assignees WHERE task_id = ?').run(taskId);
    const ins = db.prepare('INSERT OR IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)');
    userIds.forEach((id) => ins.run(taskId, id));
  });
  tx();
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.json({ ok: true });
});

tasksCoreRouter.patch('/tasks/:taskId/time', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const task = ensureTask(taskId);
  const estimatedMinutes = clampInt(req.body?.estimatedMinutes, 0);
  const actualMinutes = clampInt(req.body?.actualMinutes, 0);
  db.prepare('UPDATE tasks SET estimated_minutes = ?, actual_seconds = ?, updated_at = ? WHERE id = ?').run(
    estimatedMinutes,
    actualMinutes * 60,
    nowIso(),
    taskId,
  );
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.json({ ok: true });
});

tasksCoreRouter.post('/tasks/:taskId/timer/start', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const task = ensureTask(taskId);
  const active = db
    .prepare('SELECT id FROM timer_entries WHERE task_id = ? AND ended_at IS NULL LIMIT 1')
    .get(taskId);
  if (active) return res.status(400).json({ error: 'Timer gia attivo su questa task' });
  db.prepare('INSERT INTO timer_entries (task_id, started_at, ended_at, duration_seconds) VALUES (?, ?, NULL, 0)').run(
    taskId,
    nowIso(),
  );
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.status(201).json({ ok: true });
});

tasksCoreRouter.post('/tasks/:taskId/timer/stop', (req, res) => {
  const taskId = parseId(req.params.taskId, 'taskId');
  const task = ensureTask(taskId);
  const active = db
    .prepare('SELECT id, started_at AS startedAt FROM timer_entries WHERE task_id = ? AND ended_at IS NULL LIMIT 1')
    .get(taskId) as { id: number; startedAt: string } | undefined;
  if (!active) return res.status(400).json({ error: 'Nessun timer attivo da fermare' });

  const endedAt = nowIso();
  const duration = Math.max(1, Math.floor((Date.parse(endedAt) - Date.parse(active.startedAt)) / 1000));
  const tx = db.transaction(() => {
    db.prepare('UPDATE timer_entries SET ended_at = ?, duration_seconds = ? WHERE id = ?').run(endedAt, duration, active.id);
    db.prepare('UPDATE tasks SET actual_seconds = actual_seconds + ?, updated_at = ? WHERE id = ?').run(
      duration,
      nowIso(),
      taskId,
    );
  });
  tx();
  const updated = db.prepare('SELECT actual_seconds AS actualSeconds FROM tasks WHERE id = ?').get(taskId) as {
    actualSeconds: number;
  };
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), task.project_id);
  res.json({ ok: true, addedSeconds: duration, actualSeconds: updated.actualSeconds });
});
