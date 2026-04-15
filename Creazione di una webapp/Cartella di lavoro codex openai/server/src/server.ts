import cors from 'cors';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { createTasksExtraRouter } from './routes/tasks-extra.js';
import { projectsRouter } from './routes/projects.js';
import { tasksCoreRouter } from './routes/tasks-core.js';
import { usersRouter } from './routes/users.js';
import { dbPath, initDb, nowIso, seedUsers, uploadsDir } from './db.js';

const PORT = Number(process.env.PORT ?? 8787);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

initDb();
seedUsers();

const app = express();
app.use(
  cors({
    origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173', 'http://localhost:5173'],
    credentials: false,
  }),
);
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext.slice(0, 12).replace(/[^a-z0-9.]/g, '');
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${base}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: nowIso() });
});

app.use('/api', projectsRouter);
app.use('/api', usersRouter);
app.use('/api', tasksCoreRouter);
app.use('/api', createTasksExtraRouter(upload.single('file'), uploadsDir));

app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: unknown) => {
  const status = error.status ?? 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || 'Errore interno del server' });
});

app.listen(PORT, () => {
  console.log(`Kanban API pronta su http://localhost:${PORT}`);
  console.log(`DB SQLite: ${dbPath}`);
});
