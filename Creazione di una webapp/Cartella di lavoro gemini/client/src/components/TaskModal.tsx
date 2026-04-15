import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Task, User } from '../types';

interface TaskModalProps {
  projectId: number;
  columnId: number | null;
  task: Task | null;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ projectId, columnId, task, users, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_hours: 0,
    deadline: '',
    assigned_user_id: '',
    color: '#444444'
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        estimated_hours: task.estimated_hours || 0,
        deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
        assigned_user_id: task.assigned_user_id ? task.assigned_user_id.toString() : '',
        color: task.color || '#444444'
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (task) {
        await axios.put(`http://localhost:3001/api/tasks/${task.id}`, {
          ...formData,
          assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id) : null
        });
        toast.success('Task aggiornato');
      } else {
        await axios.post('http://localhost:3001/api/tasks', {
          ...formData,
          column_id: columnId,
          order_index: 0,
          assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id) : null
        });
        toast.success('Task creato');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error('Errore nel salvataggio del task');
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('Sei sicuro di voler eliminare questo task?')) {
      try {
        await axios.delete(`http://localhost:3001/api/tasks/${task.id}`);
        toast.success('Task eliminato');
        onSaved();
        onClose();
      } catch (error) {
        toast.error('Errore nell\'eliminazione');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <div className="modal-header">
          <h2>{task ? 'Modifica Task' : 'Nuovo Task'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Titolo</label>
            <input 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Cosa bisogna fare?"
            />
          </div>

          <div className="form-group">
            <label>Descrizione</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Dettagli aggiuntivi..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Ore Stimate</label>
              <input 
                type="number"
                step="0.5"
                value={formData.estimated_hours}
                onChange={e => setFormData({...formData, estimated_hours: parseFloat(e.target.value)})}
              />
            </div>
            <div className="form-group flex-1">
              <label>Scadenza</label>
              <input 
                type="date"
                value={formData.deadline}
                onChange={e => setFormData({...formData, deadline: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Assegna a</label>
            <select 
              value={formData.assigned_user_id}
              onChange={e => setFormData({...formData, assigned_user_id: e.target.value})}
            >
              <option value="">Nessuno</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Colore Etichetta</label>
            <input 
              type="color"
              value={formData.color}
              onChange={e => setFormData({...formData, color: e.target.value})}
              className="h-10 p-1"
            />
          </div>

          <div className="modal-footer">
            {task && (
              <button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Elimina
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="bg-slate-700 hover:bg-slate-600">
                Annulla
              </button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Salva
              </button>
            </div>
          </div>
        </form>
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
        .modal-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: white;
        }
        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }
        .form-row {
          display: flex;
          gap: 1rem;
        }
        .modal-footer {
          margin-top: 1rem;
          display: flex;
          gap: 0.75rem;
          border-top: 1px solid #1e293b;
          padding-top: 1.25rem;
        }
      `}</style>
    </div>
  );
};

export default TaskModal;
