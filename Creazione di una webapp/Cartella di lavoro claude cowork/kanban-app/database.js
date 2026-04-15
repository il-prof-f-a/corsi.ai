'use strict';
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');
let db = null;

function isFirstRun() {
  return !fs.existsSync(DB_PATH);
}

function getDb() {
  return db;
}

function openDatabase(password) {
  const firstRun = !fs.existsSync(DB_PATH);
  let instance;
  try {
    instance = new Database(DB_PATH);
    // Chiave SQLCipher — deve essere il PRIMO pragma eseguito
    instance.pragma(`key="${password.replace(/"/g, '""')}"`);
    // Test: se la chiave è errata, questa query lancia un'eccezione
    instance.prepare('SELECT count(*) FROM sqlite_master').get();

    db = instance;
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

    if (firstRun) {
      initializeSchema();
    }
    return { success: true, firstRun };
  } catch (err) {
    if (instance) { try { instance.close(); } catch (_) {} }
    // Se era un primo avvio e fallisce, rimuoviamo il file vuoto/corrotto
    if (firstRun && fs.existsSync(DB_PATH)) {
      try { fs.unlinkSync(DB_PATH); } catch (_) {}
    }
    return { success: false, error: 'Password errata' };
  }
}

function closeDatabase() {
  if (db) { db.close(); db = null; }
}

function initializeSchema() {
  const version = db.pragma('user_version', { simple: true });
  if (version > 0) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT '',
      avatar_color TEXT    NOT NULL DEFAULT '#6366f1',
      created_at   DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      color       TEXT    NOT NULL DEFAULT '#6366f1',
      deadline    DATE,
      created_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS columns (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      color      TEXT    NOT NULL DEFAULT '#64748b',
      is_done    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id        INTEGER NOT NULL,
      project_id       INTEGER NOT NULL,
      title            TEXT    NOT NULL,
      description      TEXT    NOT NULL DEFAULT '',
      color            TEXT    NOT NULL DEFAULT '#6366f1',
      priority         TEXT    NOT NULL DEFAULT 'medium',
      assigned_to      INTEGER,
      assigned_by      INTEGER,
      estimated_hours  REAL    NOT NULL DEFAULT 0,
      actual_hours     REAL    NOT NULL DEFAULT 0,
      timer_started_at DATETIME,
      due_date         DATE,
      position         INTEGER NOT NULL DEFAULT 0,
      created_at       DATETIME DEFAULT (datetime('now')),
      completed_at     DATETIME,
      FOREIGN KEY (column_id)   REFERENCES columns(id)       ON DELETE CASCADE,
      FOREIGN KEY (project_id)  REFERENCES projects(id)      ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES collaborators(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by) REFERENCES collaborators(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_time_logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id          INTEGER NOT NULL,
      started_at       DATETIME NOT NULL,
      stopped_at       DATETIME,
      duration_minutes REAL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  db.pragma('user_version = 1');
  seedExampleData();
}

function seedExampleData() {
  const ic = db.prepare(
    'INSERT INTO collaborators (name, role, avatar_color) VALUES (?, ?, ?)'
  );
  const c1 = ic.run('Mario Rossi',    'Developer',       '#6366f1').lastInsertRowid;
  const c2 = ic.run('Giulia Bianchi', 'Designer',        '#ec4899').lastInsertRowid;
  const c3 = ic.run('Luca Verdi',     'Project Manager', '#10b981').lastInsertRowid;

  const ip = db.prepare(
    'INSERT INTO projects (name, description, color, deadline) VALUES (?, ?, ?, ?)'
  );
  const deadline = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);
  const p1 = ip.run('Progetto Demo', "Progetto di esempio per esplorare l'app", '#6366f1', deadline).lastInsertRowid;

  const ico = db.prepare(
    'INSERT INTO columns (project_id, name, position, color, is_done) VALUES (?, ?, ?, ?, ?)'
  );
  const col1 = ico.run(p1, 'TODO',       0, '#64748b', 0).lastInsertRowid;
  const col2 = ico.run(p1, 'IN WORKING', 1, '#3b82f6', 0).lastInsertRowid;
  const col3 = ico.run(p1, 'DONE',       2, '#10b981', 1).lastInsertRowid;

  const it = db.prepare(`
    INSERT INTO tasks
      (column_id, project_id, title, description, color, priority, assigned_to, assigned_by, estimated_hours, due_date, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  it.run(col1, p1, 'Analisi requisiti',        'Raccogliere e documentare i requisiti',      '#6366f1', 'high',   c1, c3, 8,  deadline, 0);
  it.run(col1, p1, 'Setup ambiente sviluppo',  'Configurare repo, CI/CD e ambienti',         '#f59e0b', 'medium', c1, c3, 4,  null,     1);
  it.run(col2, p1, 'Design mockup',            "Wireframe e mockup dell'interfaccia",         '#ec4899', 'high',   c2, c3, 16, deadline, 0);
  it.run(col3, p1, 'Kick-off meeting',         'Riunione di avvio con tutti gli stakeholder','#10b981', 'medium', c3, c3, 2,  null,     0);
}

module.exports = { isFirstRun, getDb, openDatabase, closeDatabase };
