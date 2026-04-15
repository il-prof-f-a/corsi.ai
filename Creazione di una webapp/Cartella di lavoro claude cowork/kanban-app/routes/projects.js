'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

const DEFAULT_COLUMNS = [
  { name: 'TODO',       position: 0, color: '#64748b', is_done: 0 },
  { name: 'IN WORKING', position: 1, color: '#3b82f6', is_done: 0 },
  { name: 'DONE',       position: 2, color: '#10b981', is_done: 1 }
];

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT t.id)                                          AS task_count,
      COUNT(DISTINCT CASE WHEN c.is_done = 1 THEN t.id END)        AS done_count
    FROM projects p
    LEFT JOIN columns c ON c.project_id = p.id
    LEFT JOIN tasks   t ON t.column_id  = c.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

// GET /api/projects/:id  (board completa)
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

  const columns = db.prepare(
    'SELECT * FROM columns WHERE project_id = ? ORDER BY position'
  ).all(req.params.id);

  const taskQuery = db.prepare(`
    SELECT t.*,
      ct.name         AS assigned_to_name,  ct.avatar_color AS assigned_to_color,
      cb.name         AS assigned_by_name,  cb.avatar_color AS assigned_by_color
    FROM tasks t
    LEFT JOIN collaborators ct ON ct.id = t.assigned_to
    LEFT JOIN collaborators cb ON cb.id = t.assigned_by
    WHERE t.column_id = ?
    ORDER BY t.position
  `);
  for (const col of columns) col.tasks = taskQuery.all(col.id);

  const collaborators = db.prepare(
    'SELECT * FROM collaborators ORDER BY name'
  ).all();

  res.json({ ...project, columns, collaborators });
});

// POST /api/projects
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description = '', color = '#6366f1', deadline = null } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome richiesto' });

  const pid = db.prepare(
    'INSERT INTO projects (name, description, color, deadline) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), description, color, deadline).lastInsertRowid;

  const ic = db.prepare(
    'INSERT INTO columns (project_id, name, position, color, is_done) VALUES (?, ?, ?, ?, ?)'
  );
  for (const c of DEFAULT_COLUMNS) ic.run(pid, c.name, c.position, c.color, c.is_done);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(pid));
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Progetto non trovato' });
  const { name, description, color, deadline } = req.body;
  db.prepare(
    'UPDATE projects SET name=?, description=?, color=?, deadline=? WHERE id=?'
  ).run(
    name        ?? p.name,
    description ?? p.description,
    color       ?? p.color,
    deadline !== undefined ? deadline : p.deadline,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Progetto non trovato' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
