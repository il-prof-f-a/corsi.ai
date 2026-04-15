import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { TaskDetail, User } from '../types';
import { formatDate, formatSeconds } from '../utils';

type TaskDialogProps = {
  open: boolean;
  taskId: number | null;
  users: User[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
};

export function TaskDialog({ open, taskId, users, onClose, onSaved, onDeleted }: TaskDialogProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [commentUserId, setCommentUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    setError(null);
    api
      .getTask(taskId)
      .then((data) => {
        setTask(data);
        if (data.assignees.length > 0) setCommentUserId(data.assignees[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore caricamento task'))
      .finally(() => setLoading(false));
  }, [open, taskId]);

  const selectedUserIds = useMemo(() => task?.assignees.map((u) => u.id) ?? [], [task]);

  if (!open || !taskId) return null;

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const form = event.target as HTMLFormElement;
      const formData = new FormData(form);
      const title = String(formData.get('title') ?? '').trim();
      if (!title) throw new Error('Il titolo e obbligatorio');
      const payload = {
        title,
        description: String(formData.get('description') ?? ''),
        priority: String(formData.get('priority') ?? 'media'),
        color: String(formData.get('color') ?? '#22c55e'),
        estimatedMinutes: Number(formData.get('estimatedMinutes') ?? 0),
        actualMinutes: Number(formData.get('actualMinutes') ?? 0),
        startDate: String(formData.get('startDate') ?? '') || null,
        dueDate: String(formData.get('dueDate') ?? '') || null,
      };
      await api.updateTask(task.id, payload);
      const userIds = Array.from(formData.getAll('assignees')).map((entry) => Number(entry));
      await api.setTaskAssignees(task.id, userIds);
      const updated = await api.getTask(task.id);
      setTask(updated);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTimer() {
    if (!task) return;
    try {
      if (task.activeTimerStartedAt) await api.stopTimer(task.id);
      else await api.startTimer(task.id);
      const updated = await api.getTask(task.id);
      setTask(updated);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore timer');
    }
  }

  async function addComment() {
    if (!task || !comment.trim()) return;
    try {
      await api.addComment(task.id, comment.trim(), commentUserId);
      const updated = await api.getTask(task.id);
      setTask(updated);
      setComment('');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiunta commento');
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!task || !event.target.files || event.target.files.length === 0) return;
    try {
      await api.uploadAttachment(task.id, event.target.files[0]);
      const updated = await api.getTask(task.id);
      setTask(updated);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento allegato');
    } finally {
      event.target.value = '';
    }
  }

  async function removeAttachment(attachmentId: number) {
    if (!task) return;
    try {
      await api.deleteAttachment(attachmentId);
      const updated = await api.getTask(task.id);
      setTask(updated);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimozione allegato');
    }
  }

  async function removeComment(commentId: number) {
    if (!task) return;
    try {
      await api.deleteComment(commentId);
      const updated = await api.getTask(task.id);
      setTask(updated);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimozione commento');
    }
  }

  async function deleteTask() {
    if (!task) return;
    if (!window.confirm('Eliminare definitivamente questa task?')) return;
    try {
      await api.deleteTask(task.id);
      await onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione task');
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="dialog">
        <header className="dialog-header">
          <h2>Dettaglio task</h2>
          <button className="ghost" onClick={onClose} title="Chiudi finestra dettaglio task">
            Chiudi
          </button>
        </header>
        {loading ? <p>Caricamento...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {task ? (
          <form className="task-form" onSubmit={saveTask}>
            <label>
              Titolo
              <input name="title" defaultValue={task.title} required title="Titolo della task" />
            </label>
            <label>
              Descrizione
              <textarea name="description" defaultValue={task.description} title="Descrizione completa della task" />
            </label>
            <div className="task-grid">
              <label>
                Priorita
                <select name="priority" defaultValue={task.priority} title="Seleziona la priorita">
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
              <label>
                Colore
                <input type="color" name="color" defaultValue={task.color} title="Colore della card task" />
              </label>
              <label>
                Tempo stimato (min)
                <input type="number" name="estimatedMinutes" min={0} defaultValue={task.estimatedMinutes} title="Minuti stimati per completare la task" />
              </label>
              <label>
                Tempo consuntivo (min)
                <input type="number" name="actualMinutes" min={0} defaultValue={Math.round(task.actualSeconds / 60)} title="Minuti effettivamente spesi (manuale)" />
              </label>
              <label>
                Inizio
                <input type="datetime-local" name="startDate" defaultValue={task.startDate ? task.startDate.slice(0, 16) : ''} title="Data ora inizio task" />
              </label>
              <label>
                Scadenza
                <input type="datetime-local" name="dueDate" defaultValue={task.dueDate ? task.dueDate.slice(0, 16) : ''} title="Data ora scadenza task" />
              </label>
            </div>

            <label>
              Assegnatari
              <select name="assignees" multiple defaultValue={selectedUserIds.map(String)} title="Assegna la task a uno o piu collaboratori">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="timer-row">
              <span>Tempo timer attuale: {formatSeconds(task.actualSeconds + task.activeTimerElapsedSeconds)}</span>
              <button type="button" className="ghost" onClick={() => void toggleTimer()} title="Avvia o ferma il timer di lavoro della task">
                {task.activeTimerStartedAt ? 'Ferma timer' : 'Avvia timer'}
              </button>
            </div>

            <div className="dialog-actions">
              <button className="primary" type="submit" disabled={saving} title="Salva modifiche task">
                Salva
              </button>
              <button type="button" className="danger" onClick={() => void deleteTask()} title="Elimina definitivamente la task">
                Elimina task
              </button>
            </div>
          </form>
        ) : null}

        {task ? (
          <>
            <section className="sub-panel">
              <h3>Commenti</h3>
              <div className="inline-row">
                <select
                  value={commentUserId ?? ''}
                  onChange={(event) => setCommentUserId(event.target.value ? Number(event.target.value) : null)}
                  title="Seleziona autore del commento"
                >
                  <option value="">Nessun autore</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Nuovo commento"
                  title="Scrivi un commento per questa task"
                />
                <button className="ghost" onClick={() => void addComment()} title="Aggiungi commento">
                  Aggiungi
                </button>
              </div>
              <ul className="plain-list">
                {task.comments.map((item) => (
                  <li key={item.id}>
                    <strong>{item.userName ?? 'Anonimo'}:</strong> {item.content}{' '}
                    <small>({formatDate(item.createdAt)})</small>{' '}
                    <button className="ghost" onClick={() => void removeComment(item.id)} title="Rimuovi commento">
                      x
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sub-panel">
              <h3>Allegati</h3>
              <input type="file" onChange={handleUpload} title="Carica file allegato alla task" />
              <ul className="plain-list">
                {task.attachments.map((file) => (
                  <li key={file.id}>
                    <a href={file.url} target="_blank" rel="noreferrer">
                      {file.originalName}
                    </a>{' '}
                    <small>({Math.round(file.size / 1024)} KB)</small>{' '}
                    <button className="ghost" onClick={() => void removeAttachment(file.id)} title="Rimuovi allegato">
                      x
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
