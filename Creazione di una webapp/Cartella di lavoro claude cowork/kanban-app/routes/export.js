'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database');

const DB_PATH = path.join(__dirname, '..', 'data.db');

// GET /api/export/json
router.get('/json', (req, res) => {
  const db = getDb();
  const collaborators = db.prepare('SELECT * FROM collaborators ORDER BY name').all();
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all();

  for (const p of projects) {
    p.columns = db.prepare(
      'SELECT * FROM columns WHERE project_id=? ORDER BY position'
    ).all(p.id);
    for (const col of p.columns) {
      col.tasks = db.prepare(
        'SELECT * FROM tasks WHERE column_id=? ORDER BY position'
      ).all(col.id);
      for (const t of col.tasks) {
        t.time_logs = db.prepare(
          'SELECT * FROM task_time_logs WHERE task_id=? ORDER BY started_at'
        ).all(t.id);
      }
    }
  }

  const filename = `kanban-export-${Date.now()}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json({ exported_at: new Date().toISOString(), version: 1, collaborators, projects });
});

// GET /api/export/db
router.get('/db', (req, res) => {
  res.download(DB_PATH, 'kanban-data.db', err => {
    if (err && !res.headersSent)
      res.status(500).json({ error: 'Errore durante il download' });
  });
});

module.exports = router;
