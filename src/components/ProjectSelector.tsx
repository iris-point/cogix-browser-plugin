import React, { useState, useEffect } from 'react';
import { Folder, ChevronLeft, Search, Plus, CheckCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface ProjectSelectorProps {
  onSelect: (project: Project) => void;
  onBack: () => void;
}

export function ProjectSelector({ onSelect, onBack }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadCurrentProject();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProjects' });
      if (response.success) {
        setProjects(response.data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentProject = async () => {
    const response = await chrome.runtime.sendMessage({ action: 'getAuthState' });
    if (response.success && response.data.currentProjectId) {
      setSelectedId(response.data.currentProjectId);
    }
  };

  const handleSelect = async (project: Project) => {
    setSelectedId(project.id);
    const response = await chrome.runtime.sendMessage({
      action: 'selectProject',
      projectId: project.id
    });
    if (response.success) {
      onSelect(project);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="font-medium text-gray-900">Select Project</h2>
        </div>
        
        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search projects..."
          />
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No projects found</p>
            <a
              href="http://localhost:3000/projects"
              target="_blank"
              className="inline-flex items-center gap-1 mt-3 text-sm text-primary-600 hover:text-primary-700"
            >
              <Plus className="w-4 h-4" />
              Create a project
            </a>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedId === project.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Folder className={`w-4 h-4 mt-0.5 ${
                    selectedId === project.id ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {selectedId === project.id && (
                    <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}