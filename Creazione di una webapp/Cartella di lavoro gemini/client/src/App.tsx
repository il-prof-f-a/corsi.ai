import { useState } from 'react';
import ProjectList from './components/ProjectList';
import KanbanBoard from './components/KanbanBoard';
import { Toaster } from 'react-hot-toast';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-right" />
      {selectedProjectId === null ? (
        <ProjectList onSelectProject={(id) => setSelectedProjectId(id)} />
      ) : (
        <KanbanBoard 
          projectId={selectedProjectId} 
          onBack={() => setSelectedProjectId(null)} 
        />
      )}
    </div>
  );
}

export default App;
