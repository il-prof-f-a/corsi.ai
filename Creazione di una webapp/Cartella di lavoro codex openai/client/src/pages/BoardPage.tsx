import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { TaskDialog } from '../components/TaskDialog';
import type { BoardData, BoardColumn, TaskSummary, User } from '../types';
import { formatDate, formatMinutes, formatSeconds, getPriorityLabel } from '../utils';

const columnPalette = ['#2563eb', '#f59e0b', '#16a34a', '#9333ea', '#dc2626', '#0891b2'];

export function BoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const numericProjectId = Number(projectId);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState('#64748b');

  const sortedColumns = useMemo(
    () => (board?.columns ? [...board.columns].sort((a, b) => a.position - b.position) : []),
    [board],
  );

  async function loadAll() {
    if (!Number.isInteger(numericProjectId)) return;
    setLoading(true);
    setError(null);
    try {
      const [boardData, userData] = await Promise.all([
        api.getBoard(numericProjectId),
        api.listUsers(),
      ]);
      setBoard(boardData);
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento board');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isInteger(numericProjectId)) navigate('/');
    void loadAll();
  }, [numericProjectId]);

  async function addColumn() {
    const name = window.prompt('Nome nuova colonna');
    if (!name || !board) return;
    try {
      const color = columnPalette[Math.floor(Math.random() * columnPalette.length)];
      await api.createColumn(board.project.id, { name: name.trim(), color });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione colonna');
    }
  }

  async function renameColumn(column: BoardColumn) {
    const nextName = window.prompt('Nuovo nome colonna', column.name);
    if (!nextName) return;
    try {
      await api.updateColumn(column.id, { name: nextName.trim(), color: column.color });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rinomina colonna');
    }
  }

  async function removeColumn(column: BoardColumn) {
    if (!board) return;
    const candidate = sortedColumns.find((item) => item.id !== column.id);
    if (!candidate) return setError('Serve almeno una colonna per spostare le task');
    if (!window.confirm(`Eliminare colonna "${column.name}"?`)) return;
    try {
      await api.deleteColumn(column.id, candidate.id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione colonna');
    }
  }

  async function moveColumn(column: BoardColumn, direction: 'left' | 'right') {
    if (!board) return;
    const index = sortedColumns.findIndex((item) => item.id === column.id);
    if (index < 0) return;
    const swapIndex = direction === 'left' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sortedColumns.length) return;
    const copy = [...sortedColumns];
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    await api.reorderColumns(board.project.id, copy.map((item) => item.id));
    await loadAll();
  }

  async function addTask(column: BoardColumn, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!board) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem('quickTask') as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;
    try {
      await api.createTask({
        projectId: board.project.id,
        columnId: column.id,
        title,
      });
      input.value = '';
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione task');
    }
  }

  async function moveTask(taskId: number, toColumnId: number) {
    try {
      await api.moveTask(taskId, toColumnId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore spostamento task');
    }
  }

  async function reorderTask(taskId: number, direction: 'up' | 'down') {
    try {
      await api.reorderTask(taskId, direction);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore riordino task');
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    if (!newUserName.trim()) return;
    try {
      await api.createUser({ name: newUserName.trim(), avatarColor: newUserColor });
      setNewUserName('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione collaboratore');
    }
  }

  if (loading) return <main className="board-page">Caricamento board...</main>;
  if (!board) return <main className="board-page">Progetto non trovato</main>;

  return (
    <main className="board-page">
      <header className="board-header">
        <div>
          <Link to="/" className="ghost" title="Torna all'elenco progetti">
            ← Progetti
          </Link>
          <h1>{board.project.name}</h1>
          <p>{board.project.description || 'Nessuna descrizione progetto'}</p>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={() => void loadAll()} title="Ricarica dati board">
            Aggiorna
          </button>
          <button className="primary" onClick={() => void addColumn()} title="Aggiungi una nuova colonna alla Kanban">
            Nuova colonna
          </button>
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel collaborators">
        <h2>Collaboratori</h2>
        <form onSubmit={createUser} className="inline-row">
          <input
            value={newUserName}
            onChange={(event) => setNewUserName(event.target.value)}
            placeholder="Nuovo collaboratore"
            title="Nome collaboratore da aggiungere"
          />
          <input
            type="color"
            value={newUserColor}
            onChange={(event) => setNewUserColor(event.target.value)}
            title="Colore avatar collaboratore"
          />
          <button className="ghost" type="submit" title="Aggiungi collaboratore locale">
            Aggiungi
          </button>
        </form>
        <div className="chips">
          {users.map((user) => (
            <span key={user.id} className="chip" style={{ borderColor: user.avatar_color }}>
              {user.name}
            </span>
          ))}
        </div>
      </section>

      <section className="board-scroll">
        <div className="columns">
          {sortedColumns.map((column) => (
            <article
              key={column.id}
              className="column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragTaskId && void moveTask(dragTaskId, column.id)}
            >
              <header className="column-header" style={{ borderTopColor: column.color }}>
                <h2>{column.name}</h2>
                <div className="inline-row compact">
                  <button className="ghost" onClick={() => void moveColumn(column, 'left')} title="Sposta colonna a sinistra">
                    ←
                  </button>
                  <button className="ghost" onClick={() => void moveColumn(column, 'right')} title="Sposta colonna a destra">
                    →
                  </button>
                  <button className="ghost" onClick={() => void renameColumn(column)} title="Rinomina colonna">
                    Rinomina
                  </button>
                  {!column.isDefault ? (
                    <button className="danger" onClick={() => void removeColumn(column)} title="Elimina colonna e sposta task">
                      Elimina
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="task-list">
                {column.tasks.map((task: TaskSummary) => (
                  <div
                    key={task.id}
                    className="task-card"
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => setDragTaskId(null)}
                    style={{ borderLeftColor: task.color }}
                  >
                    <button className="task-title-button" onClick={() => setSelectedTaskId(task.id)} title="Apri dettaglio task">
                      {task.title}
                    </button>
                    <p>{task.description || 'Nessuna descrizione'}</p>
                    <div className="task-meta">
                      <span>Priorita: {getPriorityLabel(task.priority)}</span>
                      <span>Stima: {formatMinutes(task.estimatedMinutes)}</span>
                      <span>
                        Consuntivo:{' '}
                        {formatSeconds(
                          task.actualSeconds + (task.hasActiveTimer ? task.activeTimerElapsedSeconds : 0),
                        )}
                      </span>
                      <span>Commenti: {task.commentCount}</span>
                      <span>Allegati: {task.attachmentCount}</span>
                      <span>Scadenza: {formatDate(task.dueDate)}</span>
                    </div>
                    <div className="chips">
                      {task.assignees.map((assignee) => (
                        <span key={assignee.id} className="chip" style={{ borderColor: assignee.avatarColor }}>
                          {assignee.name}
                        </span>
                      ))}
                    </div>
                    <div className="inline-row compact">
                      <button className="ghost" onClick={() => void reorderTask(task.id, 'up')} title="Sposta task in alto">
                        ↑
                      </button>
                      <button className="ghost" onClick={() => void reorderTask(task.id, 'down')} title="Sposta task in basso">
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form className="quick-task-form" onSubmit={(event) => void addTask(column, event)}>
                <input name="quickTask" placeholder="Nuova task..." title="Aggiungi rapidamente una task in questa colonna" />
                <button className="primary" type="submit" title="Crea task nella colonna corrente">
                  +
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <TaskDialog
        open={selectedTaskId !== null}
        taskId={selectedTaskId}
        users={users}
        onClose={() => setSelectedTaskId(null)}
        onSaved={loadAll}
        onDeleted={loadAll}
      />
    </main>
  );
}
