'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

const WITH_NAMES = `
  SELECT t.*,
    ct.name AS assigned_to_name, ct.avatar_color AS assigned_to_color,
    cb.name AS assigned_by_name, cb.avatar_color AS assigned_by_color
  FROM tasks t
  LEFT JOIN collaborators ct ON ct.id = t.assigned_to
  LEFT JOIN collaborators cb ON cb.id = t.assigned_by
`;

// POST /api/tasks/reorder  — PRIMA di /:id per evitare conflitti
router.post('/reorder', (req, res) => {
  const db = getDb();
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Array tasks richiesto' });

  const upd = db.prepare('UPDATE tasks SET column_id=?, position=? WHERE id=?');
  db.transaction(() => tasks.forEach(t => upd.run(t.column_id, t.position, t.id)))();
  res.json({ success: true });
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare(WITH_NAMES + ' WHERE t.id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task non trovata' });
  res.json(task);
});

// POST /api/tasks
router.post('/', (req, res) => {
  const db = getDb();
  const {
    column_id, project_id, title, description = '',
    color = '#6366f1', priority = 'medium',
    assigned_to = null, assigned_by = null,
    estimated_hours = 0, due_date = null
  } = req.body;

  if (!column_id || !project_id || !title?.trim())
    return res.status(400).json({ error: 'column_id, project_id e title richiesti' });

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE column_id = ?'
  ).get(column_id).m;

  const id = db.prepare(`
    INSERT INTO tasks
      (column_id, project_id, title, description, color, priority,
       assigned_to, assigned_by, estimated_hours, due_date, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    column_id, project_id, title.trim(), description, color, priority,
    assigned_to, assigned_by, estimated_hours, due_date, maxPos + 1
  ).lastInsertRowid;

  res.status(201).json(db.prepare(WITH_NAMES + ' WHERE t.id = ?').get(id));
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task non trovata' });

  const {
    column_id, title, description, color, priority,
    assigned_to, assigned_by, estimated_hours, actual_hours,
    due_date, position
  } = req.body;

  // Gestione completed_at automatica basata su is_done della colonna
  let completed_at = task.completed_at;
  const newColId = column_id ?? task.column_id;
  if (newColId !== task.column_id) {
    const newCol = db.prepare('SELECT is_done FROM columns WHERE id = ?').get(newColId);
    if (newCol?.is_done && !task.completed_at) {
      completed_at = new Date().toISOString();
    } else if (!newCol?.is_done) {
      completed_at = null;
    }
  }

  db.prepare(`
    UPDATE tasks SET
      column_id=?, title=?, description=?, color=?, priority=?,
      assigned_to=?, assigned_by=?, estimated_hours=?, actual_hours=?,
      due_date=?, position=?, completed_at=?
    WHERE id=?
  `).run(
    newColId,
    title        ?? task.title,
    description  ?? task.description,
    color        ?? task.color,
    priority     ?? task.priority,
    assigned_to  !== undefined ? assigned_to  : task.assigned_to,
    assigned_by  !== undefined ? assigned_by  : task.assigned_by,
    estimated_hours ?? task.estimated_hours,
    actual_hours    ?? task.actual_hours,
    due_date !== undefined ? due_date : task.due_date,
    position ?? task.position,
    completed_at,
    req.params.id
  );

  res.json(db.prepare(WITH_NAMES + ' WHERE t.id = ?').get(req.params.id));
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Task non trovata' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/tasks/:id/timer/start
router.post('/:id/timer/start', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT id, timer_started_at FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task non trovata' });
  if (task.timer_started_at) return res.status(400).json({ error: 'Timer già attivo' });

  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET timer_started_at=? WHERE id=?').run(now, req.params.id);
  db.prepare('INSERT INTO task_time_logs (task_id, started_at) VALUES (?, ?)').run(req.params.id, now);
  res.json({ timer_started_at: now });
});

// POST /api/tasks/:id/timer/stop
router.post('/:id/timer/stop', (req, res) => {
  const db = getDb();
  const task = db.prepare(
    'SELECT id, timer_started_at, actual_hours FROM tasks WHERE id = ?'
  ).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task non trovata' });
  if (!task.timer_started_at) return res.status(400).json({ error: 'Nessun timer attivo' });

  const now = new Date();
  const durationMinutes = (now - new Date(task.timer_started_at)) / 60000;
  const newActualHours = (task.actual_hours || 0) + durationMinutes / 60;

  db.prepare('UPDATE tasks SET timer_started_at=NULL, actual_hours=? WHERE id=?')
    .run(newActualHours, req.params.id);

  const openLog = db.prepare(
    'SELECT id FROM task_time_logs WHERE task_id=? AND stopped_at IS NULL ORDER BY id DESC LIMIT 1'
  ).get(req.params.id);
  if (openLog) {
    db.prepare('UPDATE task_time_logs SET stopped_at=?, duration_minutes=? WHERE id=?')
      .run(now.toISOString(), durationMinutes, openLog.id);
  }

  res.json({ actual_hours: newActualHours, duration_minutes: durationMinutes });
});

// GET /api/tasks/:id/timer/logs
router.get('/:id/timer/logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare(
    'SELECT * FROM task_time_logs WHERE task_id=? ORDER BY started_at DESC'
  ).all(req.params.id);
  res.json(logs);
});

module.exports = router;
