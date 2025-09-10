import { Storage } from "@plasmohq/storage"

const storage = new Storage()
const FRONTEND_URL = process.env.PLASMO_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  apiTokens?: ApiToken[]
}

export interface ApiToken {
  id: string
  name: string
  token: string
  projectId: string
  createdAt: string
  lastUsedAt?: string
}

export class ProjectAPI {
  private cachedProjects: Project[] = []
  private cachedTokens: Map<string, string> = new Map()

  async fetchProjects(): Promise<Project[]> {
    try {
      // Get session from Clerk sync
      const session = await this.getClerkSession()
      if (!session) {
        throw new Error("No active session")
      }

      // Fetch projects from frontend API
      const response = await fetch(`${FRONTEND_URL}/api/projects`, {
        headers: {
          "Authorization": `Bearer ${session.token}`,
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`)
      }

      const projects = await response.json()
      
      // Cache projects
      this.cachedProjects = projects
      await storage.set("projects", projects)
      
      return projects
    } catch (error) {
      console.error("Failed to fetch projects:", error)
      
      // Try to return cached projects
      const cached = await storage.get("projects")
      if (cached) {
        this.cachedProjects = cached as Project[]
        return this.cachedProjects
      }
      
      throw error
    }
  }

  async getProjectApiToken(projectId: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.cachedTokens.has(projectId)) {
        return this.cachedTokens.get(projectId)!
      }

      // Check storage
      const stored = await storage.get(`apiToken_${projectId}`)
      if (stored) {
        this.cachedTokens.set(projectId, stored as string)
        return stored as string
      }

      // Fetch from API
      const session = await this.getClerkSession()
      if (!session) {
        throw new Error("No active session")
      }

      const response = await fetch(`${FRONTEND_URL}/api/projects/${projectId}/tokens`, {
        headers: {
          "Authorization": `Bearer ${session.token}`,
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch API tokens: ${response.statusText}`)
      }

      const tokens = await response.json()
      
      // Use the first active token or create one if none exist
      let token: string
      if (tokens.length > 0) {
        token = tokens[0].token
      } else {
        // Create a new token
        token = await this.createApiToken(projectId, "Browser Extension")
      }

      // Cache token
      this.cachedTokens.set(projectId, token)
      await storage.set(`apiToken_${projectId}`, token)
      
      return token
    } catch (error) {
      console.error("Failed to get API token:", error)
      return null
    }
  }

  async createApiToken(projectId: string, name: string): Promise<string> {
    const session = await this.getClerkSession()
    if (!session) {
      throw new Error("No active session")
    }

    const response = await fetch(`${FRONTEND_URL}/api/projects/${projectId}/tokens`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name })
    })

    if (!response.ok) {
      throw new Error(`Failed to create API token: ${response.statusText}`)
    }

    const result = await response.json()
    return result.token
  }

  async selectProject(projectId: string): Promise<void> {
    await storage.set("selectedProjectId", projectId)
    
    // Prefetch API token
    await this.getProjectApiToken(projectId)
  }

  async getSelectedProject(): Promise<string | null> {
    const projectId = await storage.get("selectedProjectId")
    return projectId as string | null
  }

  async clearCache(): Promise<void> {
    this.cachedProjects = []
    this.cachedTokens.clear()
    await storage.remove("projects")
    
    // Clear all API tokens
    const allStorage = await chrome.storage.local.get()
    const tokenKeys = Object.keys(allStorage).filter(key => key.startsWith("apiToken_"))
    for (const key of tokenKeys) {
      await storage.remove(key)
    }
  }

  private async getClerkSession(): Promise<{ token: string } | null> {
    try {
      // Get Clerk session from extension context
      // This assumes Clerk is properly initialized
      const cookies = await chrome.cookies.getAll({
        domain: new URL(FRONTEND_URL).hostname
      })
      
      const sessionCookie = cookies.find(c => c.name === "__session")
      if (sessionCookie) {
        return { token: sessionCookie.value }
      }

      // Alternative: Check for stored session
      const storedSession = await storage.get("clerkSession")
      if (storedSession) {
        return storedSession as { token: string }
      }

      return null
    } catch (error) {
      console.error("Failed to get Clerk session:", error)
      return null
    }
  }
}

// Singleton instance
export const projectAPI = new ProjectAPI()

// Helper functions
export async function loadProjects(): Promise<Project[]> {
  return projectAPI.fetchProjects()
}

export async function selectProject(projectId: string): Promise<void> {
  return projectAPI.selectProject(projectId)
}

export async function getSelectedProjectToken(): Promise<string | null> {
  const projectId = await projectAPI.getSelectedProject()
  if (!projectId) return null
  
  return projectAPI.getProjectApiToken(projectId)
}

export async function refreshProjects(): Promise<Project[]> {
  await projectAPI.clearCache()
  return projectAPI.fetchProjects()
}