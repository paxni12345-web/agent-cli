"use strict";
/**
 * Workspace & Project Management - Multi-project support
 * Project templates, workspace settings, and project discovery
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateManager = exports.workspaceManager = exports.projectManager = exports.TemplateManager = exports.WorkspaceManager = exports.ProjectManager = void 0;
const EventBus_1 = require("../core/EventBus");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Project Manager
 */
class ProjectManager {
    projects = new Map();
    /**
     * Detect project type from directory
     */
    async detectProject(projectPath) {
        try {
            await fs.access(projectPath);
        }
        catch {
            return null;
        }
        const project = {
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
            const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
            const pkg = JSON.parse(packageJson);
            project.type = 'nodejs';
            project.language = 'javascript';
            project.packageManager = await this.detectNodePackageManager(projectPath);
            project.metadata.packageName = pkg.name;
            project.metadata.version = pkg.version;
            // Detect framework
            if (pkg.dependencies?.react || pkg.devDependencies?.react) {
                project.framework = 'react';
            }
            else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
                project.framework = 'vue';
            }
            else if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                project.framework = 'next';
            }
            else if (pkg.dependencies?.express) {
                project.framework = 'express';
            }
            // Check for TypeScript
            if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
                project.language = 'typescript';
            }
        }
        catch { }
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
                }
                else if (requirements.includes('flask')) {
                    project.framework = 'flask';
                }
                else if (requirements.includes('fastapi')) {
                    project.framework = 'fastapi';
                }
            }
            catch { }
        }
        catch { }
        // Check for Go project
        try {
            await fs.access(path.join(projectPath, 'go.mod'));
            project.type = 'go';
            project.language = 'go';
            project.packageManager = 'go';
        }
        catch { }
        // Check for Rust project
        try {
            await fs.access(path.join(projectPath, 'Cargo.toml'));
            project.type = 'rust';
            project.language = 'rust';
            project.packageManager = 'cargo';
        }
        catch { }
        // Check for Java project
        try {
            await fs.access(path.join(projectPath, 'pom.xml'));
            project.type = 'java';
            project.language = 'java';
            project.buildTool = 'maven';
        }
        catch {
            try {
                await fs.access(path.join(projectPath, 'build.gradle'));
                project.type = 'java';
                project.language = 'java';
                project.buildTool = 'gradle';
            }
            catch { }
        }
        this.projects.set(project.id, project);
        EventBus_1.eventBus.emitSync('project.detected', project, 'ProjectManager');
        return project;
    }
    /**
     * Detect Node.js package manager
     */
    async detectNodePackageManager(projectPath) {
        try {
            await fs.access(path.join(projectPath, 'yarn.lock'));
            return 'yarn';
        }
        catch { }
        try {
            await fs.access(path.join(projectPath, 'pnpm-lock.yaml'));
            return 'pnpm';
        }
        catch { }
        try {
            await fs.access(path.join(projectPath, 'bun.lockb'));
            return 'bun';
        }
        catch { }
        return 'npm';
    }
    /**
     * Get project by ID
     */
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    /**
     * List all projects
     */
    listProjects(filter) {
        let projects = Array.from(this.projects.values());
        if (filter?.type) {
            projects = projects.filter((p) => p.type === filter.type);
        }
        if (filter?.language) {
            projects = projects.filter((p) => p.language === filter.language);
        }
        return projects.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    }
    /**
     * Update project
     */
    updateProject(projectId, updates) {
        const project = this.projects.get(projectId);
        if (!project)
            return undefined;
        Object.assign(project, updates);
        project.lastAccessed = new Date();
        EventBus_1.eventBus.emitSync('project.updated', project, 'ProjectManager');
        return project;
    }
    /**
     * Delete project
     */
    deleteProject(projectId) {
        const deleted = this.projects.delete(projectId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('project.deleted', { projectId }, 'ProjectManager');
        }
        return deleted;
    }
    /**
     * Get project statistics
     */
    async getProjectStats(projectId) {
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
exports.ProjectManager = ProjectManager;
/**
 * Workspace Manager
 */
class WorkspaceManager {
    workspaces = new Map();
    activeWorkspaceId;
    /**
     * Create a new workspace
     */
    async createWorkspace(name, rootPath) {
        const workspace = {
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
        EventBus_1.eventBus.emitSync('workspace.created', workspace, 'WorkspaceManager');
        return workspace;
    }
    /**
     * Open a workspace
     */
    async openWorkspace(workspaceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace)
            return false;
        this.activeWorkspaceId = workspaceId;
        EventBus_1.eventBus.emitSync('workspace.opened', workspace, 'WorkspaceManager');
        return true;
    }
    /**
     * Get active workspace
     */
    getActiveWorkspace() {
        if (!this.activeWorkspaceId)
            return undefined;
        return this.workspaces.get(this.activeWorkspaceId);
    }
    /**
     * Add project to workspace
     */
    addProject(workspaceId, project) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace)
            return false;
        workspace.projects.push(project);
        EventBus_1.eventBus.emitSync('workspace.project_added', { workspaceId, project }, 'WorkspaceManager');
        return true;
    }
    /**
     * Update workspace settings
     */
    updateSettings(workspaceId, settings) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace)
            return false;
        workspace.settings = { ...workspace.settings, ...settings };
        EventBus_1.eventBus.emitSync('workspace.settings_updated', workspace, 'WorkspaceManager');
        return true;
    }
    /**
     * List all workspaces
     */
    listWorkspaces() {
        return Array.from(this.workspaces.values());
    }
    /**
     * Delete workspace
     */
    deleteWorkspace(workspaceId) {
        if (this.activeWorkspaceId === workspaceId) {
            this.activeWorkspaceId = undefined;
        }
        const deleted = this.workspaces.delete(workspaceId);
        if (deleted) {
            EventBus_1.eventBus.emitSync('workspace.deleted', { workspaceId }, 'WorkspaceManager');
        }
        return deleted;
    }
}
exports.WorkspaceManager = WorkspaceManager;
/**
 * Project Template Manager
 */
class TemplateManager {
    templates = new Map();
    constructor() {
        this.initializeDefaultTemplates();
    }
    initializeDefaultTemplates() {
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
                    content: JSON.stringify({
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
                    }, null, 2),
                },
                {
                    path: 'tsconfig.json',
                    content: JSON.stringify({
                        compilerOptions: {
                            target: 'ES2020',
                            lib: ['ES2020', 'DOM'],
                            jsx: 'react-jsx',
                            module: 'ESNext',
                            moduleResolution: 'bundler',
                            strict: true,
                        },
                    }, null, 2),
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
                    content: JSON.stringify({
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
                    }, null, 2),
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
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    /**
     * List all templates
     */
    listTemplates(filter) {
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
    async createFromTemplate(templateId, targetPath, projectName) {
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
        EventBus_1.eventBus.emitSync('project.created_from_template', { templateId, targetPath, projectName }, 'TemplateManager');
    }
}
exports.TemplateManager = TemplateManager;
/**
 * Singleton instances
 */
exports.projectManager = new ProjectManager();
exports.workspaceManager = new WorkspaceManager();
exports.templateManager = new TemplateManager();
