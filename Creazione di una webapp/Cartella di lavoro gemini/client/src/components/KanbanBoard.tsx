import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as DndKit from '@dnd-kit/core';
import * as DndSortable from '@dnd-kit/sortable';
import { ArrowLeft, Plus, Users, Clock, Calendar, MoreHorizontal } from 'lucide-react';
import type { User, Task, Column, Project } from '../types';
import toast from 'react-hot-toast';

import ColumnComponent from './KanbanColumn';
import TaskComponent from './KanbanTask';
import TaskModal from './TaskModal';

const { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} = DndKit;

const { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} = DndSortable;

interface KanbanBoardProps {
  projectId: number;
  onBack: () => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<any>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchBoardData();
    fetchUsers();
  }, [projectId]);

  const fetchBoardData = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/projects/${projectId}`);
      setProject(response.data);
      setColumns(response.data.columns);
      setTasks(response.data.tasks);
    } catch (error) {
      toast.error('Errore nel caricamento della board');
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

  const handleDragStart = (event: DndKit.DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DndKit.DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverATask = over.data.current?.type === 'Task';

    if (!isActiveATask) return;

    if (isActiveATask && isOverATask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].column_id !== tasks[overIndex].column_id) {
          const newTasks = [...tasks];
          newTasks[activeIndex] = { ...newTasks[activeIndex], column_id: tasks[overIndex].column_id };
          return arrayMove(newTasks, activeIndex, overIndex);
        }

        return arrayMove(tasks, activeIndex, overIndex);
      });
    }

    const isOverAColumn = over.data.current?.type === 'Column';

    if (isActiveATask && isOverAColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const newTasks = [...tasks];
        newTasks[activeIndex] = { ...newTasks[activeIndex], column_id: overId as number };
        return arrayMove(newTasks, activeIndex, activeIndex);
      });
    }
  };

  const handleDragEnd = async (event: DndKit.DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const updatedTasks = tasks.map((t, idx) => ({
      id: t.id,
      column_id: t.column_id,
      order_index: idx
    }));

    try {
      await axios.post('http://localhost:3001/api/tasks/reorder', { tasks: updatedTasks });
    } catch (error) {
      toast.error('Errore nel salvataggio della posizione');
    }
  };

  const openAddTask = (columnId: number) => {
    setSelectedColumnId(columnId);
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleAddColumn = async () => {
    const title = window.prompt('Inserisci il titolo della nuova colonna:');
    if (!title) return;
    try {
      await axios.post('http://localhost:3001/api/columns', {
        project_id: projectId,
        title,
        order_index: columns.length,
        color: '#334155'
      });
      fetchBoardData();
      toast.success('Colonna aggiunta');
    } catch (error) {
      toast.error('Errore nell\'aggiunta della colonna');
    }
  };

  return (
    <div className="kanban-container">
      <header className="board-header">
        <div className="flex items-center gap-4">
          <div className="tooltip-trigger">
            <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
              <ArrowLeft size={20} />
            </button>
            <span className="tooltip">Torna ai progetti</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{project?.name}</h1>
            <p className="text-sm text-slate-400">Board Kanban</p>
          </div>
        </div>
        
        <div className="flex gap-4">
           <div className="tooltip-trigger">
            <button onClick={() => toast.success('Funzionalità in arrivo!')} className="flex items-center gap-2 bg-slate-800">
              <Users size={18} />
              Collaboratori
            </button>
            <span className="tooltip">Gestisci chi lavora con te</span>
          </div>
          <div className="tooltip-trigger">
            <button onClick={handleAddColumn} className="bg-blue-600 hover:bg-blue-700">
              Aggiungi Colonna
            </button>
            <span className="tooltip">Personalizza il tuo workflow</span>
          </div>
        </div>
      </header>

      <div className="board-content">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="columns-wrapper">
            {columns.map((col) => (
              <ColumnComponent 
                key={col.id} 
                column={col} 
                tasks={tasks.filter(t => t.column_id === col.id)}
                onAddTask={() => openAddTask(col.id)}
                onEditTask={openEditTask}
                users={users}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskComponent task={activeTask} users={users} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {isTaskModalOpen && (
        <TaskModal 
          projectId={projectId}
          columnId={selectedColumnId}
          task={editingTask}
          users={users}
          onClose={() => setIsTaskModalOpen(false)}
          onSaved={fetchBoardData}
        />
      )}

      <style>{`
        .kanban-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #0f111a;
        }
        .board-header {
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
          background-color: #0f111a;
        }
        .board-content {
          flex: 1;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 1.5rem;
        }
        .columns-wrapper {
          display: flex;
          gap: 1.5rem;
          height: 100%;
          min-width: min-content;
        }
      `}</style>
    </div>
  );
};

export default KanbanBoard;
