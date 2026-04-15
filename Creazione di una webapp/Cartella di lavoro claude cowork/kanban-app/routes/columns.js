'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// POST /api/columns
router.post('/', (req, res) => {
  const db = getDb();
  const { project_id, name, color = '#64748b', is_done = 0 } = req.body;
  if (!project_id || !name?.trim())
    return res.status(400).json({ error: 'project_id e name richiesti' });

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM columns WHERE project_id = ?'
  ).get(project_id).m;

  const id = db.prepare(
    'INSERT INTO columns (project_id, name, position, color, is_done) VALUES (?, ?, ?, ?, ?)'
  ).run(project_id, name.trim(), maxPos + 1, color, is_done ? 1 : 0).lastInsertRowid;

  res.status(201).json(db.prepare('SELECT * FROM columns WHERE id = ?').get(id));
});

// PUT /api/columns/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  if (!col) return res.status(404).json({ error: 'Colonna non trovata' });
  const { name, color, is_done } = req.body;
  db.prepare('UPDATE columns SET name=?, color=?, is_done=? WHERE id=?').run(
    name    ?? col.name,
    color   ?? col.color,
    is_done !== undefined ? (is_done ? 1 : 0) : col.is_done,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id));
});

// DELETE /api/columns/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM columns WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Colonna non trovata' });

  const taskCount = db.prepare(
    'SELECT COUNT(*) AS c FROM tasks WHERE column_id = ?'
  ).get(req.params.id).c;

  if (taskCount > 0)
    return res.status(400).json({
      error: `La colonna contiene ${taskCount} task. Spostale prima di eliminarla.`,
      taskCount
    });

  db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/columns/reorder  — [{ id, position }, ...]
router.post('/reorder', (req, res) => {
  const db = getDb();
  const { columns } = req.body;
  if (!Array.isArray(columns)) return res.status(400).json({ error: 'Array columns richiesto' });

  const upd = db.prepare('UPDATE columns SET position=? WHERE id=?');
  db.transaction(() => columns.forEach(c => upd.run(c.position, c.id)))();
  res.json({ success: true });
});

module.exports = router;
