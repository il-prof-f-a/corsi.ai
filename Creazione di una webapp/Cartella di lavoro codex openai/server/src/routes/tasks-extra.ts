import { Router, type RequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, ensureTask, nowIso, parseId } from '../db.js';

export function createTasksExtraRouter(uploadSingle: RequestHandler, uploadsDir: string) {
  const router = Router();

  router.get('/tasks/:taskId', (req, res) => {
    const taskId = parseId(String(req.params.taskId), 'taskId');
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task non trovata' });

    const assignees = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.avatar_color AS avatarColor
         FROM task_assignees ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id = ?
         ORDER BY u.name ASC`,
      )
      .all(taskId);

    const comments = db
      .prepare(
        `SELECT c.id, c.task_id AS taskId, c.user_id AS userId, c.content, c.created_at AS createdAt,
                u.name AS userName, u.avatar_color AS userColor
         FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ?
         ORDER BY c.created_at DESC, c.id DESC`,
      )
      .all(taskId);

    const attachments = db
      .prepare(
        `SELECT id, task_id AS taskId, original_name AS originalName, stored_name AS storedName,
                mime_type AS mimeType, size, created_at AS createdAt
         FROM task_attachments
         WHERE task_id = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(taskId)
      .map((row: any) => ({ ...row, url: `/uploads/${row.storedName}` }));

    const activeTimer = db
      .prepare('SELECT started_at AS startedAt FROM timer_entries WHERE task_id = ? AND ended_at IS NULL LIMIT 1')
      .get(taskId) as { startedAt: string } | undefined;
    const activeTimerElapsedSeconds = activeTimer
      ? Math.max(0, Math.floor((Date.now() - Date.parse(activeTimer.startedAt)) / 1000))
      : 0;

    res.json({
      id: task.id,
      projectId: task.project_id,
      columnId: task.column_id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      color: task.color,
      estimatedMinutes: task.estimated_minutes,
      actualSeconds: task.actual_seconds,
      startDate: task.start_date,
      dueDate: task.due_date,
      completedAt: task.completed_at,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      assignees,
      comments,
      attachments,
      activeTimerStartedAt: activeTimer?.startedAt ?? null,
      activeTimerElapsedSeconds,
    });
  });

  router.get('/tasks/:taskId/comments', (req, res) => {
    const taskId = parseId(String(req.params.taskId), 'taskId');
    ensureTask(taskId);
    const comments = db
      .prepare(
        `SELECT c.id, c.task_id AS taskId, c.user_id AS userId, c.content, c.created_at AS createdAt,
                u.name AS userName, u.avatar_color AS userColor
         FROM task_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.task_id = ?
         ORDER BY c.created_at DESC, c.id DESC`,
      )
      .all(taskId);
    res.json(comments);
  });

  router.post('/tasks/:taskId/comments', (req, res) => {
    const taskId = parseId(String(req.params.taskId), 'taskId');
    ensureTask(taskId);
    const content = String(req.body?.content ?? '').trim();
    const userIdRaw = req.body?.userId;
    const userId = userIdRaw ? Number(userIdRaw) : null;
    if (!content) return res.status(400).json({ error: 'Il commento non puo essere vuoto' });
    const result = db
      .prepare('INSERT INTO task_comments (task_id, user_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(taskId, Number.isInteger(userId) ? userId : null, content, nowIso());
    const created = db
      .prepare(
        `SELECT c.id, c.task_id AS taskId, c.user_id AS userId, c.content, c.created_at AS createdAt,
                u.name AS userName, u.avatar_color AS userColor
         FROM task_comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`,
      )
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  });

  router.delete('/comments/:commentId', (req, res) => {
    const commentId = parseId(req.params.commentId, 'commentId');
    db.prepare('DELETE FROM task_comments WHERE id = ?').run(commentId);
    res.status(204).send();
  });

  router.get('/tasks/:taskId/attachments', (req, res) => {
    const taskId = parseId(String(req.params.taskId), 'taskId');
    ensureTask(taskId);
    const rows = db
      .prepare(
        `SELECT id, task_id AS taskId, original_name AS originalName, stored_name AS storedName,
                mime_type AS mimeType, size, created_at AS createdAt
         FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .all(taskId)
      .map((row: any) => ({ ...row, url: `/uploads/${row.storedName}` }));
    res.json(rows);
  });

  router.post('/tasks/:taskId/attachments', uploadSingle, (req, res) => {
    const taskId = parseId(String(req.params.taskId), 'taskId');
    ensureTask(taskId);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'File mancante' });
    const result = db
      .prepare(
        `INSERT INTO task_attachments (task_id, original_name, stored_name, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(taskId, file.originalname, file.filename, file.mimetype, file.size, nowIso());
    const attachment = db
      .prepare(
        `SELECT id, task_id AS taskId, original_name AS originalName, stored_name AS storedName,
                mime_type AS mimeType, size, created_at AS createdAt
         FROM task_attachments WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as any;
    res.status(201).json({ ...attachment, url: `/uploads/${attachment.storedName}` });
  });

  router.delete('/attachments/:attachmentId', (req, res) => {
    const attachmentId = parseId(req.params.attachmentId, 'attachmentId');
    const attachment = db
      .prepare('SELECT stored_name AS storedName FROM task_attachments WHERE id = ?')
      .get(attachmentId) as { storedName: string } | undefined;
    if (!attachment) return res.status(404).json({ error: 'Allegato non trovato' });
    db.prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);
    const filePath = path.join(uploadsDir, attachment.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(204).send();
  });

  return router;
}
