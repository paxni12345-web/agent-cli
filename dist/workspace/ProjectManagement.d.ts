/**
 * Workspace & Project Management - Multi-project support
 * Project templates, workspace settings, and project discovery
 */
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
    files: Array<{
        path: string;
        content: string;
    }>;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}
/**
 * Project Manager
 */
export declare class ProjectManager {
    private projects;
    /**
     * Detect project type from directory
     */
    detectProject(projectPath: string): Promise<Project | null>;
    /**
     * Detect Node.js package manager
     */
    private detectNodePackageManager;
    /**
     * Get project by ID
     */
    getProject(projectId: string): Project | undefined;
    /**
     * List all projects
     */
    listProjects(filter?: {
        type?: string;
        language?: string;
    }): Project[];
    /**
     * Update project
     */
    updateProject(projectId: string, updates: Partial<Project>): Project | undefined;
    /**
     * Delete project
     */
    deleteProject(projectId: string): boolean;
    /**
     * Get project statistics
     */
    getProjectStats(projectId: string): Promise<{
        fileCount: number;
        lineCount: number;
        size: number;
        languages: Record<string, number>;
    }>;
}
/**
 * Workspace Manager
 */
export declare class WorkspaceManager {
    private workspaces;
    private activeWorkspaceId?;
    /**
     * Create a new workspace
     */
    createWorkspace(name: string, rootPath: string): Promise<Workspace>;
    /**
     * Open a workspace
     */
    openWorkspace(workspaceId: string): Promise<boolean>;
    /**
     * Get active workspace
     */
    getActiveWorkspace(): Workspace | undefined;
    /**
     * Add project to workspace
     */
    addProject(workspaceId: string, project: Project): boolean;
    /**
     * Update workspace settings
     */
    updateSettings(workspaceId: string, settings: Partial<WorkspaceSettings>): boolean;
    /**
     * List all workspaces
     */
    listWorkspaces(): Workspace[];
    /**
     * Delete workspace
     */
    deleteWorkspace(workspaceId: string): boolean;
}
/**
 * Project Template Manager
 */
export declare class TemplateManager {
    private templates;
    constructor();
    private initializeDefaultTemplates;
    /**
     * Get template by ID
     */
    getTemplate(templateId: string): ProjectTemplate | undefined;
    /**
     * List all templates
     */
    listTemplates(filter?: {
        language?: string;
        framework?: string;
    }): ProjectTemplate[];
    /**
     * Create project from template
     */
    createFromTemplate(templateId: string, targetPath: string, projectName: string): Promise<void>;
}
/**
 * Singleton instances
 */
export declare const projectManager: ProjectManager;
export declare const workspaceManager: WorkspaceManager;
export declare const templateManager: TemplateManager;
//# sourceMappingURL=ProjectManagement.d.ts.map