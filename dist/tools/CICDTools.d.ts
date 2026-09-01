/**
 * CI/CD Pipeline Tools - Automate build, test, and deployment
 * Support for GitHub Actions, GitLab CI, CircleCI, Jenkins
 */
import { Tool } from '../types';
/**
 * CI/CD Pipeline Tool
 */
export declare const CICDPipelineTool: Tool;
/**
 * Deployment Tool
 */
export declare const DeploymentTool: Tool;
/**
 * Rollback Tool
 */
export declare const RollbackTool: Tool;
/**
 * Build Tool
 */
export declare const BuildTool: Tool;
/**
 * Artifact Manager
 */
export declare const ArtifactTool: Tool;
/**
 * Pipeline Configuration Generator
 */
export declare class PipelineGenerator {
    /**
     * Generate GitHub Actions workflow
     */
    static githubActions(config: {
        name: string;
        triggers: string[];
        jobs: Array<{
            name: string;
            steps: string[];
        }>;
    }): string;
    /**
     * Generate GitLab CI configuration
     */
    static gitlabCI(config: {
        stages: string[];
        jobs: Record<string, any>;
    }): string;
}
//# sourceMappingURL=CICDTools.d.ts.map