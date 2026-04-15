import { Router } from 'express';
import { db, nowIso, parseId } from '../db.js';
export const usersRouter = Router();
usersRouter.get('/users', (_req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY name ASC, id ASC').all();
    res.json(users);
});
usersRouter.post('/users', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim() || null;
    const avatarColor = String(req.body?.avatarColor ?? '#64748b').trim() || '#64748b';
    if (!name)
        return res.status(400).json({ error: 'Il nome del collaboratore e obbligatorio' });
    const result = db
        .prepare('INSERT INTO users (name, email, avatar_color, created_at) VALUES (?, ?, ?, ?)')
        .run(name, email, avatarColor, nowIso());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
});
usersRouter.put('/users/:userId', (req, res) => {
    const userId = parseId(req.params.userId, 'userId');
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!current)
        return res.status(404).json({ error: 'Collaboratore non trovato' });
    const name = String(req.body?.name ?? current.name).trim();
    const emailRaw = req.body?.email ?? current.email;
    const email = emailRaw ? String(emailRaw).trim() : null;
    const avatarColor = String(req.body?.avatarColor ?? current.avatar_color).trim() || current.avatar_color;
    if (!name)
        return res.status(400).json({ error: 'Il nome del collaboratore e obbligatorio' });
    db.prepare('UPDATE users SET name = ?, email = ?, avatar_color = ? WHERE id = ?').run(name, email, avatarColor, userId);
    res.json({ ok: true });
});
usersRouter.delete('/users/:userId', (req, res) => {
    const userId = parseId(req.params.userId, 'userId');
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.status(204).send();
});
