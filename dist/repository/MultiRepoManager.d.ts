/**
 * Multi-Repository Management System
 * Manage multiple repositories, cross-repo operations, and workspace coordination
 */
export interface Repository {
    id: string;
    name: string;
    path: string;
    remoteUrl?: string;
    branch: string;
    status: RepositoryStatus;
    metadata: RepositoryMetadata;
    dependencies: RepositoryDependency[];
    tags: string[];
}
export interface RepositoryStatus {
    ahead: number;
    behind: number;
    staged: number;
    unstaged: number;
    untracked: number;
    conflicts: number;
    lastCommit?: CommitInfo;
    isDirty: boolean;
}
export interface RepositoryMetadata {
    language?: string;
    framework?: string;
    packageManager?: string;
    version?: string;
    description?: string;
    contributors: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface RepositoryDependency {
    repositoryId: string;
    type: 'build' | 'runtime' | 'development';
    version?: string;
}
export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: Date;
}
export interface Workspace {
    id: string;
    name: string;
    description?: string;
    repositories: string[];
    settings: WorkspaceSettings;
    createdAt: Date;
    updatedAt: Date;
}
export interface WorkspaceSettings {
    defaultBranch: string;
    syncStrategy: 'pull' | 'rebase' | 'merge';
    autoSync: boolean;
    parallelOperations: boolean;
    maxParallelOps: number;
}
export interface CrossRepoOperation {
    id: string;
    type: CrossRepoOperationType;
    repositories: string[];
    status: OperationStatus;
    results: OperationResult[];
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export declare enum CrossRepoOperationType {
    Pull = "pull",
    Push = "push",
    Sync = "sync",
    Build = "build",
    Test = "test",
    Deploy = "deploy",
    Search = "search",
    Refactor = "refactor"
}
export declare enum OperationStatus {
    Pending = "pending",
    Running = "running",
    Completed = "completed",
    Failed = "failed",
    PartialSuccess = "partial_success"
}
export interface OperationResult {
    repositoryId: string;
    success: boolean;
    output?: string;
    error?: string;
    duration: number;
}
export interface DependencyGraph {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
}
export interface DependencyNode {
    repositoryId: string;
    name: string;
    level: number;
}
export interface DependencyEdge {
    from: string;
    to: string;
    type: RepositoryDependency['type'];
}
/**
 * Multi-Repository Manager
 */
export declare class MultiRepoManager {
    private repositories;
    private workspaces;
    private operations;
    /**
     * Add repository
     */
    addRepository(repo: Omit<Repository, 'id'>): Repository;
    /**
     * Remove repository
     */
    removeRepository(repoId: string): void;
    /**
     * Get repository
     */
    getRepository(repoId: string): Repository | undefined;
    /**
     * List repositories
     */
    listRepositories(filter?: {
        tags?: string[];
        language?: string;
    }): Repository[];
    /**
     * Update repository status
     */
    updateRepositoryStatus(repoId: string): Promise<RepositoryStatus>;
    /**
     * Create workspace
     */
    createWorkspace(name: string, repositoryIds: string[], settings?: Partial<WorkspaceSettings>): Workspace;
    /**
     * Get workspace
     */
    getWorkspace(workspaceId: string): Workspace | undefined;
    /**
     * List workspaces
     */
    listWorkspaces(): Workspace[];
    /**
     * Add repository to workspace
     */
    addToWorkspace(workspaceId: string, repoId: string): void;
    /**
     * Remove repository from workspace
     */
    removeFromWorkspace(workspaceId: string, repoId: string): void;
    /**
     * Execute cross-repository operation
     */
    executeOperation(type: CrossRepoOperationType, repositoryIds: string[], options?: any): Promise<CrossRepoOperation>;
    /**
     * Execute operation on workspace
     */
    executeOnWorkspace(workspaceId: string, type: CrossRepoOperationType, options?: any): Promise<CrossRepoOperation>;
    /**
     * Build dependency graph
     */
    buildDependencyGraph(repositoryIds: string[]): DependencyGraph;
    /**
     * Get build order
     */
    getBuildOrder(repositoryIds: string[]): string[];
    /**
     * Search across repositories
     */
    searchAcrossRepos(repositoryIds: string[], query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Sync workspace
     */
    syncWorkspace(workspaceId: string): Promise<SyncResult>;
    /**
     * Clone repository
     */
    cloneRepository(url: string, path: string, name: string): Promise<Repository>;
    /**
     * Execute operation sequentially
     */
    private executeSequential;
    /**
     * Execute operation in parallel
     */
    private executeParallel;
    /**
     * Execute operation on single repository
     */
    private executeOnRepository;
    private searchInRepository;
    private syncRepository;
    private determineOperationStatus;
    private generateRepoId;
    private generateWorkspaceId;
    private generateOperationId;
}
export interface SearchOptions {
    caseSensitive?: boolean;
    regex?: boolean;
    filePattern?: string;
    excludePattern?: string;
}
export interface SearchResult {
    repositoryId: string;
    repositoryName: string;
    matches: SearchMatch[];
}
export interface SearchMatch {
    file: string;
    line: number;
    column: number;
    text: string;
    context?: string;
}
export interface SyncResult {
    workspaceId: string;
    results: RepositorySyncResult[];
    timestamp: Date;
}
export interface RepositorySyncResult {
    repositoryId: string;
    success: boolean;
    changes?: {
        pulled: number;
        pushed: number;
        conflicts: number;
    };
    error?: string;
}
/**
 * Repository Analyzer
 */
export declare class RepositoryAnalyzer {
    /**
     * Analyze repository
     */
    analyzeRepository(repo: Repository): Promise<RepositoryAnalysis>;
    private calculateMetrics;
    private assessCodeQuality;
    private analyzeDependencies;
    private analyzeContributors;
}
export interface RepositoryAnalysis {
    repositoryId: string;
    metrics: RepositoryMetrics;
    codeQuality: CodeQualityMetrics;
    dependencies: DependencyAnalysis;
    contributors: ContributorAnalysis[];
    timestamp: Date;
}
export interface RepositoryMetrics {
    linesOfCode: number;
    files: number;
    commits: number;
    branches: number;
    contributors: number;
    issues: number;
    pullRequests: number;
}
export interface CodeQualityMetrics {
    maintainability: number;
    testCoverage: number;
    technicalDebt: number;
    duplicateCode: number;
    complexity: number;
}
export interface DependencyAnalysis {
    total: number;
    outdated: number;
    vulnerable: number;
    licenses: Record<string, number>;
}
export interface ContributorAnalysis {
    name: string;
    commits: number;
    linesAdded: number;
    linesRemoved: number;
}
/**
 * Singleton instances
 */
export declare const multiRepoManager: MultiRepoManager;
export declare const repositoryAnalyzer: RepositoryAnalyzer;
//# sourceMappingURL=MultiRepoManager.d.ts.map