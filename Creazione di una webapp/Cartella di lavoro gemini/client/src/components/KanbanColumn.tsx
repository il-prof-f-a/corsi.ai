import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal } from 'lucide-react';
import type { Column, Task, User } from '../types';
import TaskComponent from './KanbanTask';

interface ColumnProps {
  column: Column;
  tasks: Task[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  users: User[];
}

const KanbanColumn: React.FC<ColumnProps> = ({ column, tasks, onAddTask, onEditTask, users }) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  return (
    <div ref={setNodeRef} className="column-container">
      <div className="column-header">
        <div className="flex items-center gap-2">
          <div className="column-dot" style={{ backgroundColor: column.color }}></div>
          <h3 className="column-title">{column.title}</h3>
          <span className="task-count">{tasks.length}</span>
        </div>
        <button className="p-1 hover:bg-slate-700 rounded text-slate-400">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="column-tasks">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskComponent 
              key={task.id} 
              task={task} 
              onEdit={() => onEditTask(task)}
              users={users}
            />
          ))}
        </SortableContext>
      </div>

      <div className="tooltip-trigger mt-4">
        <button onClick={onAddTask} className="add-task-btn">
          <Plus size={18} />
          Aggiungi Task
        </button>
        <span className="tooltip">Inserisci una nuova attività in questa colonna</span>
      </div>

      <style>{`
        .column-container {
          width: 320px;
          background-color: #161922;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          padding: 1rem;
          max-height: 100%;
          border: 1px solid #1e293b;
        }
        .column-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          padding: 0 0.5rem;
        }
        .column-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .column-title {
          font-weight: 600;
          color: #f8fafc;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .task-count {
          background-color: #1e293b;
          color: #94a3b8;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 0.5rem;
        }
        .column-tasks {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 50px;
          padding-bottom: 1rem;
        }
        .add-task-btn {
          width: 100%;
          background-color: transparent;
          border: 1px dashed #334155;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        .add-task-btn:hover {
          background-color: #1e293b;
          border-color: #646cff;
          color: #f8fafc;
        }
      `}</style>
    </div>
  );
};

export default KanbanColumn;
