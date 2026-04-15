import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: '*', // Permette tutte le origini per sviluppo locale
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Projects Routes
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  const result = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, description);
  
  // Create default columns for the new project
  const projectId = result.lastInsertRowid;
  const defaultColumns = ['TODO', 'IN WORKING', 'DONE'];
  const insertColumn = db.prepare('INSERT INTO columns (project_id, title, order_index) VALUES (?, ?, ?)');
  
  defaultColumns.forEach((title, index) => {
    insertColumn.run(projectId, title, index);
  });

  const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(newProject);
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  
  const columns = db.prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY order_index').all();
  const tasks = db.prepare(`
    SELECT t.* FROM tasks t
    JOIN columns c ON t.column_id = c.id
    WHERE c.project_id = ?
    ORDER BY t.order_index
  `).all();

  res.json({ ...project, columns, tasks });
});

// Users/Collaborators Routes
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newUser);
});

// Columns Routes
app.post('/api/columns', (req, res) => {
  const { project_id, title, order_index, color } = req.body;
  const result = db.prepare('INSERT INTO columns (project_id, title, order_index, color) VALUES (?, ?, ?, ?)').run(project_id, title, order_index, color);
  const newColumn = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newColumn);
});

app.put('/api/columns/:id', (req, res) => {
  const { title, color } = req.body;
  db.prepare('UPDATE columns SET title = ?, color = ? WHERE id = ?').run(title, color, req.params.id);
  res.json({ success: true });
});

// Tasks Routes
app.post('/api/tasks', (req, res) => {
  const { column_id, title, description, estimated_hours, deadline, assigned_user_id, order_index, color } = req.body;
  const result = db.prepare('INSERT INTO tasks (column_id, title, description, estimated_hours, deadline, assigned_user_id, order_index, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(column_id, title, description, estimated_hours, deadline, assigned_user_id, order_index, color);
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const updates = req.body;
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  
  db.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...values, req.params.id);
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Reorder tasks
app.post('/api/tasks/reorder', (req, res) => {
  const { tasks } = req.body; // Array of { id, column_id, order_index }
  const update = db.prepare('UPDATE tasks SET column_id = ?, order_index = ? WHERE id = ?');
  
  const transaction = db.transaction((tasks) => {
    for (const task of tasks) {
      update.run(task.column_id, task.order_index, task.id);
    }
  });

  transaction(tasks);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
