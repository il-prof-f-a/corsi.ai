import { Router } from 'express';
import { db, defaultColumns, ensureColumn, ensureProject, normalizeColumnOrder, normalizeTaskOrder, nowIso, parseId, } from '../db.js';
import { getBoard } from '../board.js';
export const projectsRouter = Router();
projectsRouter.get('/projects', (_req, res) => {
    const rows = db
        .prepare(`SELECT p.*,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
       FROM projects p
       ORDER BY p.updated_at DESC, p.id DESC`)
        .all();
    res.json(rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color,
        taskCount: r.task_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    })));
});
projectsRouter.post('/projects', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const color = String(req.body?.color ?? '#0ea5e9').trim() || '#0ea5e9';
    if (!name)
        return res.status(400).json({ error: 'Il nome del progetto e obbligatorio' });
    const now = nowIso();
    const result = db
        .prepare('INSERT INTO projects (name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(name, description, color, now, now);
    const insertColumn = db.prepare('INSERT INTO columns (project_id, name, position, color, is_default) VALUES (?, ?, ?, ?, 1)');
    defaultColumns.forEach((c, i) => insertColumn.run(result.lastInsertRowid, c.name, i, c.color));
    const board = getBoard(Number(result.lastInsertRowid));
    res.status(201).json(board?.project ?? { id: result.lastInsertRowid });
});
projectsRouter.put('/projects/:projectId', (req, res) => {
    const projectId = parseId(req.params.projectId, 'projectId');
    ensureProject(projectId);
    const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const name = String(req.body?.name ?? current.name).trim();
    const description = String(req.body?.description ?? current.description).trim();
    const color = String(req.body?.color ?? current.color).trim() || current.color;
    if (!name)
        return res.status(400).json({ error: 'Il nome del progetto e obbligatorio' });
    db.prepare('UPDATE projects SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?').run(name, description, color, nowIso(), projectId);
    res.json({ ok: true });
});
projectsRouter.delete('/projects/:projectId', (req, res) => {
    const projectId = parseId(req.params.projectId, 'projectId');
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    res.status(204).send();
});
projectsRouter.get('/projects/:projectId/board', (req, res) => {
    const projectId = parseId(req.params.projectId, 'projectId');
    const board = getBoard(projectId);
    if (!board)
        return res.status(404).json({ error: 'Progetto non trovato' });
    res.json(board);
});
projectsRouter.post('/projects/:projectId/columns', (req, res) => {
    const projectId = parseId(req.params.projectId, 'projectId');
    ensureProject(projectId);
    const name = String(req.body?.name ?? '').trim();
    const color = String(req.body?.color ?? '#475569').trim() || '#475569';
    if (!name)
        return res.status(400).json({ error: 'Il nome della colonna e obbligatorio' });
    const maxPos = db
        .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM columns WHERE project_id = ?')
        .get(projectId);
    const result = db
        .prepare('INSERT INTO columns (project_id, name, position, color, is_default) VALUES (?, ?, ?, ?, 0)')
        .run(projectId, name, maxPos.maxPos + 1, color);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
    const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(column);
});
projectsRouter.put('/columns/:columnId', (req, res) => {
    const columnId = parseId(req.params.columnId, 'columnId');
    const column = ensureColumn(columnId);
    const name = String(req.body?.name ?? column.name).trim();
    const color = String(req.body?.color ?? '#475569').trim() || '#475569';
    if (!name)
        return res.status(400).json({ error: 'Il nome della colonna e obbligatorio' });
    db.prepare('UPDATE columns SET name = ?, color = ? WHERE id = ?').run(name, color, columnId);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), column.project_id);
    res.json({ ok: true });
});
projectsRouter.patch('/projects/:projectId/columns/reorder', (req, res) => {
    const projectId = parseId(req.params.projectId, 'projectId');
    const ids = Array.isArray(req.body?.columnIds) ? req.body.columnIds : [];
    if (!ids.length)
        return res.status(400).json({ error: 'columnIds obbligatorio' });
    const parsed = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id));
    const upd = db.prepare('UPDATE columns SET position = ? WHERE id = ? AND project_id = ?');
    const tx = db.transaction(() => {
        parsed.forEach((columnId, index) => upd.run(index, columnId, projectId));
        normalizeColumnOrder(projectId);
        db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
    });
    tx();
    res.json({ ok: true });
});
projectsRouter.delete('/columns/:columnId', (req, res) => {
    const columnId = parseId(req.params.columnId, 'columnId');
    const moveToColumnId = req.query.moveToColumnId ? Number(req.query.moveToColumnId) : undefined;
    const column = ensureColumn(columnId);
    const tasks = db.prepare('SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC').all(columnId);
    if (tasks.length > 0 && (!moveToColumnId || !Number.isInteger(moveToColumnId))) {
        return res.status(400).json({ error: 'La colonna contiene task. Specifica moveToColumnId.' });
    }
    const tx = db.transaction(() => {
        if (tasks.length > 0 && moveToColumnId) {
            const dest = ensureColumn(moveToColumnId);
            if (dest.project_id !== column.project_id) {
                throw new Error('La colonna di destinazione non appartiene allo stesso progetto');
            }
            const max = db
                .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM tasks WHERE column_id = ?')
                .get(moveToColumnId);
            let next = max.maxPos + 1;
            const move = db.prepare('UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ?');
            tasks.forEach((task) => {
                move.run(moveToColumnId, next, nowIso(), task.id);
                next += 1;
            });
            normalizeTaskOrder(moveToColumnId);
        }
        db.prepare('DELETE FROM columns WHERE id = ?').run(columnId);
        normalizeColumnOrder(column.project_id);
        db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), column.project_id);
    });
    tx();
    res.status(204).send();
});
