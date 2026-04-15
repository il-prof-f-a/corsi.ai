import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Calendar, User as UserIcon } from 'lucide-react';
import type { Task, User } from '../types';

interface TaskProps {
  task: Task;
  onEdit?: () => void;
  users: User[];
  isOverlay?: boolean;
}

const KanbanTask: React.FC<TaskProps> = ({ task, onEdit, users, isOverlay }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `4px solid ${task.color || '#444'}`,
  };

  const assignedUser = users.find(u => u.id === task.assigned_user_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isOverlay ? 'is-overlay' : ''}`}
      onClick={onEdit}
    >
      <h4 className="task-title">{task.title}</h4>
      
      {task.description && (
        <p className="task-desc">{task.description}</p>
      )}

      <div className="task-footer">
        <div className="task-meta">
          {task.estimated_hours > 0 && (
            <div className="meta-item tooltip-trigger">
              <Clock size={14} />
              <span>{task.estimated_hours}h</span>
              <span className="tooltip">Ore stimate per il completamento</span>
            </div>
          )}
          {task.deadline && (
            <div className="meta-item tooltip-trigger">
              <Calendar size={14} />
              <span>{new Date(task.deadline).toLocaleDateString()}</span>
              <span className="tooltip">Data di scadenza</span>
            </div>
          )}
        </div>

        <div className="task-assignee tooltip-trigger">
          {assignedUser ? (
            <div className="user-avatar">
              {assignedUser.name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <UserIcon size={16} className="text-slate-500" />
          )}
          <span className="tooltip">{assignedUser ? `Assegnato a: ${assignedUser.name}` : 'Nessun assegnatario'}</span>
        </div>
      </div>

      <style>{`
        .task-card {
          background-color: #1e293b;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          cursor: grab;
          transition: transform 0.2s, box-shadow 0.2s;
          user-select: none;
        }
        .task-card:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
          transform: translateY(-2px);
          border-color: #646cff;
        }
        .task-card.is-overlay {
          cursor: grabbing;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          transform: scale(1.05);
          z-index: 1000;
        }
        .task-title {
          font-size: 0.95rem;
          font-weight: 500;
          color: #f8fafc;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }
        .task-desc {
          font-size: 0.8rem;
          color: #94a3b8;
          margin-bottom: 1rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .task-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }
        .task-meta {
          display: flex;
          gap: 0.75rem;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #64748b;
        }
        .user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #3b82f6;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default KanbanTask;
