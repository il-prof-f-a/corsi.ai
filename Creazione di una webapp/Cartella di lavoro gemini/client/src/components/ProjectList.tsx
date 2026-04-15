import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Folder, Users } from 'lucide-react';
import type { Project, User as UserType } from '../types';

interface ProjectListProps {
  onSelectProject: (id: number) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [newUserName, setNewUserName] = useState('');

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users', error);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      await axios.post('http://localhost:3001/api/projects', { name: newName, description: newDesc });
      setNewName('');
      setNewDesc('');
      setIsAdding(false);
      fetchProjects();
    } catch (error) {
      console.error('Error adding project', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName) return;
    try {
      await axios.post('http://localhost:3001/api/users', { name: newUserName });
      setNewUserName('');
      fetchUsers();
    } catch (error) {
      console.error('Error adding user', error);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
          <Folder size={36} className="text-blue-400" />
          I Miei Progetti
        </h1>
        <div className="flex gap-4">
          <div className="tooltip-trigger">
            <button 
              onClick={() => setIsManagingUsers(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              <Users size={20} />
              Collaboratori
            </button>
            <span className="tooltip">Gestisci i membri del team</span>
          </div>
          <div className="tooltip-trigger">
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              <Plus size={20} />
              Nuovo Progetto
            </button>
            <span className="tooltip">Crea un nuovo spazio di lavoro</span>
          </div>
        </div>
      </div>

      {isManagingUsers && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-md w-full bg-slate-900 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Collaboratori</h2>
              <button onClick={() => setIsManagingUsers(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddUser} className="mb-6 flex gap-2">
              <input 
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                placeholder="Nome collaboratore..."
                className="flex-1"
              />
              <button type="submit" className="bg-blue-600 px-4">Aggiungi</button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {users.map(u => (
                <div key={u.id} className="p-3 bg-slate-800 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-slate-200">{u.name}</span>
                </div>
              ))}
              {users.length === 0 && <p className="text-slate-500 text-center">Nessun collaboratore aggiunto.</p>}
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 shadow-2xl animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-slate-200">Aggiungi Progetto</h2>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nome Progetto</label>
              <input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es: Ristrutturazione Casa"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Descrizione (opzionale)</label>
              <textarea 
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Dettagli del progetto..."
                rows={3}
              />
            </div>
            <div className="flex gap-4">
              <button type="submit" className="bg-green-600 hover:bg-green-700 flex-1">Salva</button>
              <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-700 hover:bg-slate-600">Annulla</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className="bg-slate-800/50 hover:bg-slate-800 p-6 rounded-xl border border-slate-700 cursor-pointer transition-all hover:border-blue-500 group shadow-lg"
          >
            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
              {project.name}
            </h3>
            <p className="text-slate-400 line-clamp-2 min-h-[3rem]">
              {project.description || 'Nessuna descrizione fornita.'}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500 flex justify-between items-center">
              <span>Creato il: {new Date(project.created_at).toLocaleDateString()}</span>
              <span className="tooltip-trigger">
                <span className="text-blue-500 hover:underline">Apri Kanban →</span>
                <span className="tooltip">Accedi alla board delle task</span>
              </span>
            </div>
          </div>
        ))}
        {projects.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-700 rounded-3xl">
            <p className="text-slate-500 text-lg">Nessun progetto trovato. Inizia creandone uno nuovo!</p>
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-content {
          background-color: #161922;
          width: 100%;
          max-width: 500px;
          border-radius: 12px;
          border: 1px solid #1e293b;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
};

export default ProjectList;
