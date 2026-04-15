import { clampInt, db, ensureColumn, ensureTask, normalizeTaskOrder, nowIso, } from './db.js';
export function getBoard(projectId) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project)
        return null;
    const columns = db
        .prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY position ASC, id ASC')
        .all(projectId);
    const tasks = db
        .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC, id ASC')
        .all(projectId);
    const taskIds = tasks.map((t) => t.id);
    const assigneesMap = new Map();
    if (taskIds.length > 0) {
        const rows = db
            .prepare(`SELECT ta.task_id AS taskId, u.id AS userId, u.name, u.avatar_color AS avatarColor
         FROM task_assignees ta
         JOIN users u ON u.id = ta.user_id
         WHERE ta.task_id IN (${taskIds.map(() => '?').join(',')})
         ORDER BY u.name ASC`)
            .all(...taskIds);
        rows.forEach((r) => {
            const list = assigneesMap.get(r.taskId) ?? [];
            list.push({ id: r.userId, name: r.name, avatarColor: r.avatarColor });
            assigneesMap.set(r.taskId, list);
        });
    }
    const commentsMap = new Map();
    const attachmentsMap = new Map();
    const activeTimerMap = new Map();
    if (taskIds.length > 0) {
        const commentRows = db
            .prepare(`SELECT task_id AS taskId, COUNT(*) AS total
         FROM task_comments
         WHERE task_id IN (${taskIds.map(() => '?').join(',')})
         GROUP BY task_id`)
            .all(...taskIds);
        commentRows.forEach((r) => commentsMap.set(r.taskId, r.total));
        const attachmentRows = db
            .prepare(`SELECT task_id AS taskId, COUNT(*) AS total
         FROM task_attachments
         WHERE task_id IN (${taskIds.map(() => '?').join(',')})
         GROUP BY task_id`)
            .all(...taskIds);
        attachmentRows.forEach((r) => attachmentsMap.set(r.taskId, r.total));
        const activeRows = db
            .prepare(`SELECT task_id AS taskId, started_at AS startedAt
         FROM timer_entries
         WHERE ended_at IS NULL
         AND task_id IN (${taskIds.map(() => '?').join(',')})`)
            .all(...taskIds);
        const now = Date.now();
        activeRows.forEach((r) => {
            const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(r.startedAt)) / 1000));
            activeTimerMap.set(r.taskId, { startedAt: r.startedAt, elapsedSeconds });
        });
    }
    const tasksByColumn = new Map();
    columns.forEach((c) => tasksByColumn.set(c.id, []));
    tasks.forEach((task) => {
        const timer = activeTimerMap.get(task.id);
        const list = tasksByColumn.get(task.column_id) ?? [];
        list.push({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            color: task.color,
            position: task.position,
            estimatedMinutes: task.estimated_minutes,
            actualSeconds: task.actual_seconds,
            startDate: task.start_date,
            dueDate: task.due_date,
            completedAt: task.completed_at,
            createdAt: task.created_at,
            updatedAt: task.updated_at,
            assignees: assigneesMap.get(task.id) ?? [],
            commentCount: commentsMap.get(task.id) ?? 0,
            attachmentCount: attachmentsMap.get(task.id) ?? 0,
            hasActiveTimer: Boolean(timer),
            activeTimerStartedAt: timer?.startedAt ?? null,
            activeTimerElapsedSeconds: timer?.elapsedSeconds ?? 0,
        });
        tasksByColumn.set(task.column_id, list);
    });
    return {
        project: {
            id: project.id,
            name: project.name,
            description: project.description,
            color: project.color,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
        },
        columns: columns.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            position: c.position,
            isDefault: Boolean(c.is_default),
            tasks: tasksByColumn.get(c.id) ?? [],
        })),
    };
}
export const moveTaskTx = db.transaction((taskId, toColumnId, toPosition) => {
    const task = ensureTask(taskId);
    const fromColumnId = task.column_id;
    const fromPos = task.position;
    ensureColumn(toColumnId);
    db.prepare('UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ?').run(fromColumnId, fromPos);
    const maxRow = db
        .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM tasks WHERE column_id = ? AND id != ?')
        .get(toColumnId, taskId);
    const maxPos = maxRow.maxPos;
    const desired = toPosition === undefined ? maxPos + 1 : clampInt(toPosition, maxPos + 1);
    const bounded = Math.max(0, Math.min(desired, maxPos + 1));
    db.prepare('UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?').run(toColumnId, bounded);
    const doneCol = db.prepare('SELECT name FROM columns WHERE id = ?').get(toColumnId);
    const completedAt = doneCol.name.trim().toUpperCase() === 'DONE' ? nowIso() : null;
    db.prepare('UPDATE tasks SET column_id = ?, position = ?, completed_at = ?, updated_at = ? WHERE id = ?').run(toColumnId, bounded, completedAt, nowIso(), taskId);
    normalizeTaskOrder(fromColumnId);
    if (toColumnId !== fromColumnId)
        normalizeTaskOrder(toColumnId);
});
