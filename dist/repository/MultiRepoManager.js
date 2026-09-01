"use strict";
/**
 * Multi-Repository Management System
 * Manage multiple repositories, cross-repo operations, and workspace coordination
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryAnalyzer = exports.multiRepoManager = exports.RepositoryAnalyzer = exports.MultiRepoManager = exports.OperationStatus = exports.CrossRepoOperationType = void 0;
const EventBus_1 = require("../core/EventBus");
var CrossRepoOperationType;
(function (CrossRepoOperationType) {
    CrossRepoOperationType["Pull"] = "pull";
    CrossRepoOperationType["Push"] = "push";
    CrossRepoOperationType["Sync"] = "sync";
    CrossRepoOperationType["Build"] = "build";
    CrossRepoOperationType["Test"] = "test";
    CrossRepoOperationType["Deploy"] = "deploy";
    CrossRepoOperationType["Search"] = "search";
    CrossRepoOperationType["Refactor"] = "refactor";
})(CrossRepoOperationType || (exports.CrossRepoOperationType = CrossRepoOperationType = {}));
var OperationStatus;
(function (OperationStatus) {
    OperationStatus["Pending"] = "pending";
    OperationStatus["Running"] = "running";
    OperationStatus["Completed"] = "completed";
    OperationStatus["Failed"] = "failed";
    OperationStatus["PartialSuccess"] = "partial_success";
})(OperationStatus || (exports.OperationStatus = OperationStatus = {}));
/**
 * Multi-Repository Manager
 */
class MultiRepoManager {
    repositories = new Map();
    workspaces = new Map();
    operations = new Map();
    /**
     * Add repository
     */
    addRepository(repo) {
        const fullRepo = {
            ...repo,
            id: this.generateRepoId(),
        };
        this.repositories.set(fullRepo.id, fullRepo);
        EventBus_1.eventBus.emitSync('repo.added', fullRepo, 'MultiRepoManager');
        return fullRepo;
    }
    /**
     * Remove repository
     */
    removeRepository(repoId) {
        this.repositories.delete(repoId);
        EventBus_1.eventBus.emitSync('repo.removed', { repoId }, 'MultiRepoManager');
    }
    /**
     * Get repository
     */
    getRepository(repoId) {
        return this.repositories.get(repoId);
    }
    /**
     * List repositories
     */
    listRepositories(filter) {
        let repos = Array.from(this.repositories.values());
        if (filter?.tags) {
            repos = repos.filter(r => r.tags.some(t => filter.tags.includes(t)));
        }
        if (filter?.language) {
            repos = repos.filter(r => r.metadata.language === filter.language);
        }
        return repos;
    }
    /**
     * Update repository status
     */
    async updateRepositoryStatus(repoId) {
        const repo = this.repositories.get(repoId);
        if (!repo) {
            throw new Error(`Repository not found: ${repoId}`);
        }
        // Mock implementation - in production, use git commands
        const status = {
            ahead: 0,
            behind: 0,
            staged: 0,
            unstaged: 0,
            untracked: 0,
            conflicts: 0,
            isDirty: false,
        };
        repo.status = status;
        return status;
    }
    /**
     * Create workspace
     */
    createWorkspace(name, repositoryIds, settings) {
        const workspace = {
            id: this.generateWorkspaceId(),
            name,
            repositories: repositoryIds,
            settings: {
                defaultBranch: 'main',
                syncStrategy: 'pull',
                autoSync: false,
                parallelOperations: true,
                maxParallelOps: 5,
                ...settings,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.workspaces.set(workspace.id, workspace);
        EventBus_1.eventBus.emitSync('workspace.created', workspace, 'MultiRepoManager');
        return workspace;
    }
    /**
     * Get workspace
     */
    getWorkspace(workspaceId) {
        return this.workspaces.get(workspaceId);
    }
    /**
     * List workspaces
     */
    listWorkspaces() {
        return Array.from(this.workspaces.values());
    }
    /**
     * Add repository to workspace
     */
    addToWorkspace(workspaceId, repoId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        if (!workspace.repositories.includes(repoId)) {
            workspace.repositories.push(repoId);
            workspace.updatedAt = new Date();
            EventBus_1.eventBus.emitSync('workspace.repo_added', { workspaceId, repoId }, 'MultiRepoManager');
        }
    }
    /**
     * Remove repository from workspace
     */
    removeFromWorkspace(workspaceId, repoId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        workspace.repositories = workspace.repositories.filter(id => id !== repoId);
        workspace.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('workspace.repo_removed', { workspaceId, repoId }, 'MultiRepoManager');
    }
    /**
     * Execute cross-repository operation
     */
    async executeOperation(type, repositoryIds, options = {}) {
        const operation = {
            id: this.generateOperationId(),
            type,
            repositories: repositoryIds,
            status: OperationStatus.Running,
            results: [],
            startedAt: new Date(),
        };
        this.operations.set(operation.id, operation);
        EventBus_1.eventBus.emitSync('operation.started', operation, 'MultiRepoManager');
        try {
            if (options.parallel) {
                await this.executeParallel(operation, options);
            }
            else {
                await this.executeSequential(operation, options);
            }
            operation.status = this.determineOperationStatus(operation.results);
            operation.completedAt = new Date();
            EventBus_1.eventBus.emitSync('operation.completed', operation, 'MultiRepoManager');
        }
        catch (error) {
            operation.status = OperationStatus.Failed;
            operation.error = error instanceof Error ? error.message : String(error);
            operation.completedAt = new Date();
            EventBus_1.eventBus.emitSync('operation.failed', operation, 'MultiRepoManager');
        }
        return operation;
    }
    /**
     * Execute operation on workspace
     */
    async executeOnWorkspace(workspaceId, type, options = {}) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        return this.executeOperation(type, workspace.repositories, {
            ...options,
            parallel: workspace.settings.parallelOperations,
        });
    }
    /**
     * Build dependency graph
     */
    buildDependencyGraph(repositoryIds) {
        const nodes = [];
        const edges = [];
        const visited = new Set();
        const visit = (repoId, level) => {
            if (visited.has(repoId))
                return;
            visited.add(repoId);
            const repo = this.repositories.get(repoId);
            if (!repo)
                return;
            nodes.push({
                repositoryId: repoId,
                name: repo.name,
                level,
            });
            for (const dep of repo.dependencies) {
                edges.push({
                    from: repoId,
                    to: dep.repositoryId,
                    type: dep.type,
                });
                visit(dep.repositoryId, level + 1);
            }
        };
        for (const repoId of repositoryIds) {
            visit(repoId, 0);
        }
        return { nodes, edges };
    }
    /**
     * Get build order
     */
    getBuildOrder(repositoryIds) {
        const graph = this.buildDependencyGraph(repositoryIds);
        const sorted = [];
        const visited = new Set();
        const temp = new Set();
        const visit = (nodeId) => {
            if (temp.has(nodeId)) {
                throw new Error('Circular dependency detected');
            }
            if (visited.has(nodeId)) {
                return;
            }
            temp.add(nodeId);
            const dependencies = graph.edges.filter(e => e.from === nodeId);
            for (const dep of dependencies) {
                visit(dep.to);
            }
            temp.delete(nodeId);
            visited.add(nodeId);
            sorted.push(nodeId);
        };
        for (const repoId of repositoryIds) {
            if (!visited.has(repoId)) {
                visit(repoId);
            }
        }
        return sorted.reverse();
    }
    /**
     * Search across repositories
     */
    async searchAcrossRepos(repositoryIds, query, options = {}) {
        const results = [];
        for (const repoId of repositoryIds) {
            const repo = this.repositories.get(repoId);
            if (!repo)
                continue;
            // Mock search implementation
            const matches = await this.searchInRepository(repo, query, options);
            results.push({
                repositoryId: repoId,
                repositoryName: repo.name,
                matches,
            });
        }
        return results;
    }
    /**
     * Sync workspace
     */
    async syncWorkspace(workspaceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error(`Workspace not found: ${workspaceId}`);
        }
        const results = [];
        for (const repoId of workspace.repositories) {
            const repo = this.repositories.get(repoId);
            if (!repo)
                continue;
            try {
                // Mock sync implementation
                await this.syncRepository(repo, workspace.settings.syncStrategy);
                results.push({
                    repositoryId: repoId,
                    success: true,
                    changes: {
                        pulled: 0,
                        pushed: 0,
                        conflicts: 0,
                    },
                });
            }
            catch (error) {
                results.push({
                    repositoryId: repoId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return {
            workspaceId,
            results,
            timestamp: new Date(),
        };
    }
    /**
     * Clone repository
     */
    async cloneRepository(url, path, name) {
        // Mock implementation
        const repo = this.addRepository({
            name,
            path,
            remoteUrl: url,
            branch: 'main',
            status: {
                ahead: 0,
                behind: 0,
                staged: 0,
                unstaged: 0,
                untracked: 0,
                conflicts: 0,
                isDirty: false,
            },
            metadata: {
                contributors: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            dependencies: [],
            tags: [],
        });
        return repo;
    }
    /**
     * Execute operation sequentially
     */
    async executeSequential(operation, options) {
        for (const repoId of operation.repositories) {
            const startTime = Date.now();
            try {
                const output = await this.executeOnRepository(repoId, operation.type, options);
                operation.results.push({
                    repositoryId: repoId,
                    success: true,
                    output,
                    duration: Date.now() - startTime,
                });
            }
            catch (error) {
                operation.results.push({
                    repositoryId: repoId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - startTime,
                });
            }
        }
    }
    /**
     * Execute operation in parallel
     */
    async executeParallel(operation, options) {
        const promises = operation.repositories.map(async (repoId) => {
            const startTime = Date.now();
            try {
                const output = await this.executeOnRepository(repoId, operation.type, options);
                return {
                    repositoryId: repoId,
                    success: true,
                    output,
                    duration: Date.now() - startTime,
                };
            }
            catch (error) {
                return {
                    repositoryId: repoId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - startTime,
                };
            }
        });
        operation.results = await Promise.all(promises);
    }
    /**
     * Execute operation on single repository
     */
    async executeOnRepository(repoId, type, options) {
        const repo = this.repositories.get(repoId);
        if (!repo) {
            throw new Error(`Repository not found: ${repoId}`);
        }
        // Mock implementation
        switch (type) {
            case CrossRepoOperationType.Pull:
                return 'Pulled successfully';
            case CrossRepoOperationType.Push:
                return 'Pushed successfully';
            case CrossRepoOperationType.Build:
                return 'Built successfully';
            case CrossRepoOperationType.Test:
                return 'Tests passed';
            case CrossRepoOperationType.Deploy:
                return 'Deployed successfully';
            default:
                return 'Operation completed';
        }
    }
    async searchInRepository(repo, query, options) {
        // Mock implementation
        return [];
    }
    async syncRepository(repo, strategy) {
        // Mock implementation
    }
    determineOperationStatus(results) {
        const successCount = results.filter(r => r.success).length;
        if (successCount === results.length) {
            return OperationStatus.Completed;
        }
        else if (successCount === 0) {
            return OperationStatus.Failed;
        }
        else {
            return OperationStatus.PartialSuccess;
        }
    }
    generateRepoId() {
        return `repo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateWorkspaceId() {
        return `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.MultiRepoManager = MultiRepoManager;
/**
 * Repository Analyzer
 */
class RepositoryAnalyzer {
    /**
     * Analyze repository
     */
    async analyzeRepository(repo) {
        return {
            repositoryId: repo.id,
            metrics: await this.calculateMetrics(repo),
            codeQuality: await this.assessCodeQuality(repo),
            dependencies: await this.analyzeDependencies(repo),
            contributors: await this.analyzeContributors(repo),
            timestamp: new Date(),
        };
    }
    async calculateMetrics(repo) {
        // Mock implementation
        return {
            linesOfCode: 10000,
            files: 250,
            commits: 500,
            branches: 5,
            contributors: 10,
            issues: 15,
            pullRequests: 20,
        };
    }
    async assessCodeQuality(repo) {
        // Mock implementation
        return {
            maintainability: 75,
            testCoverage: 80,
            technicalDebt: 20,
            duplicateCode: 5,
            complexity: 15,
        };
    }
    async analyzeDependencies(repo) {
        return {
            total: repo.dependencies.length,
            outdated: 0,
            vulnerable: 0,
            licenses: {},
        };
    }
    async analyzeContributors(repo) {
        return repo.metadata.contributors.map(contributor => ({
            name: contributor,
            commits: 0,
            linesAdded: 0,
            linesRemoved: 0,
        }));
    }
}
exports.RepositoryAnalyzer = RepositoryAnalyzer;
/**
 * Singleton instances
 */
exports.multiRepoManager = new MultiRepoManager();
exports.repositoryAnalyzer = new RepositoryAnalyzer();
