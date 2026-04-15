'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/collaborators
router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = c.id) AS tasks_assigned_to,
      (SELECT COUNT(*) FROM tasks WHERE assigned_by = c.id) AS tasks_assigned_by
    FROM collaborators c ORDER BY c.name
  `).all());
});

// POST /api/collaborators
router.post('/', (req, res) => {
  const db = getDb();
  const { name, role = '', avatar_color = '#6366f1' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome richiesto' });

  const id = db.prepare(
    'INSERT INTO collaborators (name, role, avatar_color) VALUES (?, ?, ?)'
  ).run(name.trim(), role, avatar_color).lastInsertRowid;

  res.status(201).json(db.prepare('SELECT * FROM collaborators WHERE id = ?').get(id));
});

// PUT /api/collaborators/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT * FROM collaborators WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collaboratore non trovato' });
  const { name, role, avatar_color } = req.body;
  db.prepare('UPDATE collaborators SET name=?, role=?, avatar_color=? WHERE id=?')
    .run(name ?? c.name, role ?? c.role, avatar_color ?? c.avatar_color, req.params.id);
  res.json(db.prepare('SELECT * FROM collaborators WHERE id = ?').get(req.params.id));
});

// DELETE /api/collaborators/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM collaborators WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Collaboratore non trovato' });

  const taskCount = db.prepare(
    'SELECT COUNT(*) AS c FROM tasks WHERE assigned_to=? OR assigned_by=?'
  ).get(req.params.id, req.params.id).c;

  if (taskCount > 0 && !req.query.force)
    return res.status(400).json({
      error: `${taskCount} task collegate a questo collaboratore.`,
      taskCount, canForce: true
    });

  if (taskCount > 0) {
    db.prepare('UPDATE tasks SET assigned_to=NULL WHERE assigned_to=?').run(req.params.id);
    db.prepare('UPDATE tasks SET assigned_by=NULL WHERE assigned_by=?').run(req.params.id);
  }
  db.prepare('DELETE FROM collaborators WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
