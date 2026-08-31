/**
 * Workspace & Project Management - Multi-project support
 * Project templates, workspace settings, and project discovery
 */

import { eventBus } from '../core/EventBus';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'nodejs' | 'python' | 'go' | 'rust' | 'java' | 'unknown';
  language: string;
  framework?: string;
  packageManager?: string;
  buildTool?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  lastAccessed: Date;
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  projects: Project[];
  settings: WorkspaceSettings;
  createdAt: Date;
}

export interface WorkspaceSettings {
  defaultProvider: string;
  defaultModel: string;
  maxIterations: number;
  autoSave: boolean;
  gitIntegration: boolean;
  linting: boolean;
  formatting: boolean;
  customCommands: Record<string, string>;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  framework?: string;
  files: Array<{ path: string; content: string }>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Project Manager
 */
export class ProjectManager {
  private projects: Map<string, Project> = new Map();

  /**
   * Detect project type from directory
   */
  async detectProject(projectPath: string): Promise<Project | null> {
    try {
      await fs.access(projectPath);
    } catch {
      return null;
    }

    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: path.basename(projectPath),
      path: projectPath,
      type: 'unknown',
      language: 'unknown',
      metadata: {},
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    // Check for Node.js project
    try {
      const packageJson = await fs.readFile(
        path.join(projectPath, 'package.json'),
        'utf-8'
      );
      const pkg = JSON.parse(packageJson);

      project.type = 'nodejs';
      project.language = 'javascript';
      project.packageManager = await this.detectNodePackageManager(projectPath);
      project.metadata.packageName = pkg.name;
      project.metadata.version = pkg.version;

      // Detect framework
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        project.framework = 'react';
      } else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        project.framework = 'vue';
      } else if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        project.framework = 'next';
      } else if (pkg.dependencies?.express) {
        project.framework = 'express';
      }

      // Check for TypeScript
      if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
        project.language = 'typescript';
      }
    } catch {}

    // Check for Python project
    try {
      await fs.access(path.join(projectPath, 'pyproject.toml'));
      project.type = 'python';
      project.language = 'python';
      project.packageManager = 'pip';

      // Check for common frameworks
      const requirementPath = path.join(projectPath, 'requirements.txt');
      try {
        const requirements = await fs.readFile(requirementPath, 'utf-8');
        if (requirements.includes('django')) {
          project.framework = 'django';
        } else if (requirements.includes('flask')) {
          project.framework = 'flask';
        } else if (requirements.includes('fastapi')) {
          project.framework = 'fastapi';
        }
      } catch {}
    } catch {}

    // Check for Go project
    try {
      await fs.access(path.join(projectPath, 'go.mod'));
      project.type = 'go';
      project.language = 'go';
      project.packageManager = 'go';
    } catch {}

    // Check for Rust project
    try {
      await fs.access(path.join(projectPath, 'Cargo.toml'));
      project.type = 'rust';
      project.language = 'rust';
      project.packageManager = 'cargo';
    } catch {}

    // Check for Java project
    try {
      await fs.access(path.join(projectPath, 'pom.xml'));
      project.type = 'java';
      project.language = 'java';
      project.buildTool = 'maven';
    } catch {
      try {
        await fs.access(path.join(projectPath, 'build.gradle'));
        project.type = 'java';
        project.language = 'java';
        project.buildTool = 'gradle';
      } catch {}
    }

    this.projects.set(project.id, project);
    eventBus.emitSync('project.detected', project, 'ProjectManager');

    return project;
  }

  /**
   * Detect Node.js package manager
   */
  private async detectNodePackageManager(projectPath: string): Promise<string> {
    try {
      await fs.access(path.join(projectPath, 'yarn.lock'));
      return 'yarn';
    } catch {}

    try {
      await fs.access(path.join(projectPath, 'pnpm-lock.yaml'));
      return 'pnpm';
    } catch {}

    try {
      await fs.access(path.join(projectPath, 'bun.lockb'));
      return 'bun';
    } catch {}

    return 'npm';
  }

  /**
   * Get project by ID
   */
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  /**
   * List all projects
   */
  listProjects(filter?: { type?: string; language?: string }): Project[] {
    let projects = Array.from(this.projects.values());

    if (filter?.type) {
      projects = projects.filter((p) => p.type === filter.type);
    }

    if (filter?.language) {
      projects = projects.filter((p) => p.language === filter.language);
    }

    return projects.sort(
      (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
    );
  }

  /**
   * Update project
   */
  updateProject(projectId: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(projectId);
    if (!project) return undefined;

    Object.assign(project, updates);
    project.lastAccessed = new Date();

    eventBus.emitSync('project.updated', project, 'ProjectManager');

    return project;
  }

  /**
   * Delete project
   */
  deleteProject(projectId: string): boolean {
    const deleted = this.projects.delete(projectId);
    if (deleted) {
      eventBus.emitSync('project.deleted', { projectId }, 'ProjectManager');
    }
    return deleted;
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId: string): Promise<{
    fileCount: number;
    lineCount: number;
    size: number;
    languages: Record<string, number>;
  }> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Mock statistics
    return {
      fileCount: 245,
      lineCount: 12500,
      size: 2.5 * 1024 * 1024, // 2.5 MB
      languages: {
        TypeScript: 8500,
        JavaScript: 2000,
        CSS: 1500,
        HTML: 500,
      },
    };
  }
}

/**
 * Workspace Manager
 */
export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private activeWorkspaceId?: string;

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string, rootPath: string): Promise<Workspace> {
    const workspace: Workspace = {
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      rootPath,
      projects: [],
      settings: {
        defaultProvider: 'anthropic',
        defaultModel: 'claude-opus-5',
        maxIterations: 10,
        autoSave: true,
        gitIntegration: true,
        linting: true,
        formatting: true,
        customCommands: {},
      },
      createdAt: new Date(),
    };

    this.workspaces.set(workspace.id, workspace);
    eventBus.emitSync('workspace.created', workspace, 'WorkspaceManager');

    return workspace;
  }

  /**
   * Open a workspace
   */
  async openWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    this.activeWorkspaceId = workspaceId;
    eventBus.emitSync('workspace.opened', workspace, 'WorkspaceManager');

    return true;
  }

  /**
   * Get active workspace
   */
  getActiveWorkspace(): Workspace | undefined {
    if (!this.activeWorkspaceId) return undefined;
    return this.workspaces.get(this.activeWorkspaceId);
  }

  /**
   * Add project to workspace
   */
  addProject(workspaceId: string, project: Project): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.projects.push(project);
    eventBus.emitSync(
      'workspace.project_added',
      { workspaceId, project },
      'WorkspaceManager'
    );

    return true;
  }

  /**
   * Update workspace settings
   */
  updateSettings(
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
  ): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    workspace.settings = { ...workspace.settings, ...settings };
    eventBus.emitSync('workspace.settings_updated', workspace, 'WorkspaceManager');

    return true;
  }

  /**
   * List all workspaces
   */
  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Delete workspace
   */
  deleteWorkspace(workspaceId: string): boolean {
    if (this.activeWorkspaceId === workspaceId) {
      this.activeWorkspaceId = undefined;
    }

    const deleted = this.workspaces.delete(workspaceId);
    if (deleted) {
      eventBus.emitSync('workspace.deleted', { workspaceId }, 'WorkspaceManager');
    }
    return deleted;
  }
}

/**
 * Project Template Manager
 */
export class TemplateManager {
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // React + TypeScript template
    this.templates.set('react-ts', {
      id: 'react-ts',
      name: 'React + TypeScript',
      description: 'React application with TypeScript and Vite',
      language: 'typescript',
      framework: 'react',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify(
            {
              name: 'my-app',
              version: '0.1.0',
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
              },
              devDependencies: {
                typescript: '^5.0.0',
                vite: '^4.0.0',
                '@vitejs/plugin-react': '^3.0.0',
              },
              scripts: {
                dev: 'vite',
                build: 'vite build',
              },
            },
            null,
            2
          ),
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify(
            {
              compilerOptions: {
                target: 'ES2020',
                lib: ['ES2020', 'DOM'],
                jsx: 'react-jsx',
                module: 'ESNext',
                moduleResolution: 'bundler',
                strict: true,
              },
            },
            null,
            2
          ),
        },
        {
          path: 'src/App.tsx',
          content: `import React from 'react';

export default function App() {
  return <div>Hello World</div>;
}`,
        },
      ],
    });

    // Express + TypeScript template
    this.templates.set('express-ts', {
      id: 'express-ts',
      name: 'Express + TypeScript',
      description: 'Express API server with TypeScript',
      language: 'typescript',
      framework: 'express',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify(
            {
              name: 'api-server',
              version: '1.0.0',
              dependencies: {
                express: '^4.18.0',
                cors: '^2.8.5',
              },
              devDependencies: {
                typescript: '^5.0.0',
                '@types/express': '^4.17.0',
                '@types/node': '^20.0.0',
              },
              scripts: {
                dev: 'ts-node src/index.ts',
                build: 'tsc',
              },
            },
            null,
            2
          ),
        },
        {
          path: 'src/index.ts',
          content: `import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
        },
      ],
    });

    // Python FastAPI template
    this.templates.set('fastapi', {
      id: 'fastapi',
      name: 'FastAPI',
      description: 'Python FastAPI application',
      language: 'python',
      framework: 'fastapi',
      files: [
        {
          path: 'requirements.txt',
          content: 'fastapi==0.104.0\nuvicorn==0.24.0\npydantic==2.5.0',
        },
        {
          path: 'main.py',
          content: `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
        },
      ],
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): ProjectTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all templates
   */
  listTemplates(filter?: { language?: string; framework?: string }): ProjectTemplate[] {
    let templates = Array.from(this.templates.values());

    if (filter?.language) {
      templates = templates.filter((t) => t.language === filter.language);
    }

    if (filter?.framework) {
      templates = templates.filter((t) => t.framework === filter.framework);
    }

    return templates;
  }

  /**
   * Create project from template
   */
  async createFromTemplate(
    templateId: string,
    targetPath: string,
    projectName: string
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create project directory
    await fs.mkdir(targetPath, { recursive: true });

    // Create files from template
    for (const file of template.files) {
      const filePath = path.join(targetPath, file.path);
      const dir = path.dirname(filePath);

      await fs.mkdir(dir, { recursive: true });

      // Replace template variables
      let content = file.content;
      content = content.replace(/{{projectName}}/g, projectName);

      await fs.writeFile(filePath, content, 'utf-8');
    }

    eventBus.emitSync(
      'project.created_from_template',
      { templateId, targetPath, projectName },
      'TemplateManager'
    );
  }
}

/**
 * Singleton instances
 */
export const projectManager = new ProjectManager();
export const workspaceManager = new WorkspaceManager();
export const templateManager = new TemplateManager();
