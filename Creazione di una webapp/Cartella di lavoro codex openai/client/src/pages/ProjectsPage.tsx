import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../types';
import { formatDate } from '../utils';

const palette = ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899'];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(palette[0]);

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleCreateProject(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createProject({ name: name.trim(), description: description.trim(), color });
      setName('');
      setDescription('');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione progetto');
    }
  }

  return (
    <main className="projects-page">
      <header className="hero">
        <div>
          <h1>Task Board Progetti</h1>
          <p>Seleziona un progetto o creane uno nuovo per aprire la Kanban.</p>
        </div>
        <button className="ghost" onClick={() => void loadProjects()} title="Ricarica elenco progetti">
          Aggiorna
        </button>
      </header>

      <section className="panel">
        <h2>Nuovo progetto</h2>
        <form className="project-form" onSubmit={handleCreateProject}>
          <label>
            Nome progetto
            <input
              title="Inserisci il nome del nuovo progetto"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Portale clienti"
              required
            />
          </label>
          <label>
            Descrizione
            <input
              title="Descrizione sintetica del progetto"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Obiettivo principale"
            />
          </label>
          <div className="color-picker-row">
            <span>Colore</span>
            <div className="color-palette">
              {palette.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`color-dot ${color === entry ? 'active' : ''}`}
                  style={{ backgroundColor: entry }}
                  onClick={() => setColor(entry)}
                  title="Seleziona il colore principale del progetto"
                />
              ))}
            </div>
          </div>
          <button className="primary" type="submit" title="Crea progetto e inizializza le 3 colonne Kanban">
            Crea progetto
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Progetti esistenti</h2>
        {loading ? <p>Caricamento in corso...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!loading && projects.length === 0 ? <p>Nessun progetto disponibile.</p> : null}
        <div className="project-grid">
          {projects.map((project) => (
            <article key={project.id} className="project-card">
              <div className="project-card-top" style={{ borderTopColor: project.color }}>
                <h3>{project.name}</h3>
                <span>{project.taskCount} task</span>
              </div>
              <p>{project.description || 'Nessuna descrizione'}</p>
              <p className="meta">Aggiornato: {formatDate(project.updatedAt)}</p>
              <button
                className="primary"
                onClick={() => navigate(`/project/${project.id}`)}
                title="Apri la board Kanban di questo progetto"
              >
                Apri board
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
