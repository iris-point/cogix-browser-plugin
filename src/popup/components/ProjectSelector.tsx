import { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { useAuth } from '@clerk/chrome-extension'
import { apiClient, type Project } from '../../lib/api-client'

const storage = new Storage()

interface ProjectSelectorProps {
  onProjectSelected?: (project: Project) => void
}

export const ProjectSelector = ({ onProjectSelected }: ProjectSelectorProps) => {
  const { getToken } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadProjects()
    loadSelectedProject()
  }, [])

  const loadProjects = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to get token from Clerk first
      let token = await getToken()
      
      // Fallback to stored token if Clerk doesn't have it
      if (!token) {
        console.log('No token from Clerk, checking storage...')
        const storedAuth = await chrome.storage.sync.get(['clerkToken'])
        token = storedAuth.clerkToken
      }
      
      if (!token) {
        throw new Error('Not authenticated')
      }
      
      console.log('Using token for API request:', token ? 'Token found' : 'No token')
      const response = await apiClient.getProjects(token)
      console.log('Projects API response:', response)
      
      // Handle different response formats
      let projectList: Project[] = []
      if (Array.isArray(response)) {
        projectList = response
      } else if (response && typeof response === 'object') {
        // Check if response has a data or projects property
        if ('data' in response && Array.isArray((response as any).data)) {
          projectList = (response as any).data
        } else if ('projects' in response && Array.isArray((response as any).projects)) {
          projectList = (response as any).projects
        } else {
          console.warn('Unexpected response format:', response)
          projectList = []
        }
      }
      
      setProjects(projectList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      console.error('Failed to load projects:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSelectedProject = async () => {
    const storedProjectId = await storage.get('selectedProjectId')
    const storedProjectName = await storage.get('selectedProjectName')
    
    if (storedProjectId && storedProjectName) {
      setSelectedProject({
        id: storedProjectId,
        name: storedProjectName,
        created_at: '',
        updated_at: ''
      })
    }
  }

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project)
    await storage.set('selectedProjectId', project.id)
    await storage.set('selectedProjectName', project.name)
    setIsOpen(false)
    onProjectSelected?.(project)
  }

  if (isLoading) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-p-4">
        <div className="plasmo-animate-spin plasmo-rounded-full plasmo-h-6 plasmo-w-6 plasmo-border-b-2 plasmo-border-[var(--primary)]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="plasmo-p-4 plasmo-bg-red-50 plasmo-border plasmo-border-red-200 plasmo-rounded-lg">
        <p className="plasmo-text-sm plasmo-text-red-600">{error}</p>
        <button
          onClick={loadProjects}
          className="plasmo-mt-2 plasmo-text-xs plasmo-text-red-600 plasmo-underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="plasmo-relative">
      {/* Selected Project Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="plasmo-w-full plasmo-p-3 plasmo-bg-white plasmo-border plasmo-border-[var(--border)] plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-between hover:plasmo-bg-[var(--card-hover)] plasmo-transition-colors"
      >
        <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
          <svg className="plasmo-w-4 plasmo-h-4 plasmo-text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="plasmo-text-sm plasmo-font-medium plasmo-text-[var(--foreground)]">
            {selectedProject ? selectedProject.name : 'Select a project'}
          </span>
        </div>
        <svg 
          className={`plasmo-w-4 plasmo-h-4 plasmo-text-[var(--muted)] plasmo-transition-transform ${isOpen ? 'plasmo-rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Project Dropdown */}
      {isOpen && (
        <div className="plasmo-absolute plasmo-top-full plasmo-left-0 plasmo-right-0 plasmo-mt-2 plasmo-bg-white plasmo-border plasmo-border-[var(--border)] plasmo-rounded-lg plasmo-shadow-lg plasmo-z-50 plasmo-max-h-60 plasmo-overflow-y-auto">
          {projects.length === 0 ? (
            <div className="plasmo-p-4 plasmo-text-center">
              <p className="plasmo-text-sm plasmo-text-[var(--muted)]">No projects found</p>
              <p className="plasmo-text-xs plasmo-text-[var(--muted)] plasmo-mt-1">
                Create a project on the Cogix platform first
              </p>
            </div>
          ) : (
            <div className="plasmo-py-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-text-left hover:plasmo-bg-[var(--card-hover)] plasmo-transition-colors"
                >
                  <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
                    <div>
                      <p className="plasmo-text-sm plasmo-font-medium plasmo-text-[var(--foreground)]">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="plasmo-text-xs plasmo-text-[var(--muted)] plasmo-mt-0.5">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {selectedProject?.id === project.id && (
                      <svg className="plasmo-w-4 plasmo-h-4 plasmo-text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Project Selected Warning */}
      {!selectedProject && (
        <div className="plasmo-mt-2 plasmo-p-2 plasmo-bg-[var(--warning)] plasmo-bg-opacity-10 plasmo-border plasmo-border-[var(--warning)] plasmo-border-opacity-20 plasmo-rounded-md">
          <p className="plasmo-text-xs plasmo-text-[var(--warning)]">
            Please select a project before recording
          </p>
        </div>
      )}
    </div>
  )
}