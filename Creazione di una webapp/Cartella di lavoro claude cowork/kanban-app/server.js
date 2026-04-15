'use strict';
const express = require('express');
const session = require('express-session');
const path = require('path');
const { isFirstRun, closeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'kanban-local-' + Math.random().toString(36).slice(2),
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Non autenticato' });
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/projects',      requireAuth, require('./routes/projects'));
app.use('/api/columns',       requireAuth, require('./routes/columns'));
app.use('/api/tasks',         requireAuth, require('./routes/tasks'));
app.use('/api/collaborators', requireAuth, require('./routes/collaborators'));
app.use('/api/export',        requireAuth, require('./routes/export'));

// SPA fallback
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nKanban App → http://localhost:${PORT}`);
  console.log(isFirstRun()
    ? '⚡  Primo avvio: crea la password per il database cifrato'
    : '🔐  Database esistente: inserisci la password per accedere');
  console.log();
});

process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });
process.on('SIGINT',  () => { closeDatabase(); process.exit(0); });
