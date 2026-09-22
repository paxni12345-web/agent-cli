import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolContext, ToolResult } from '../types/index.js';

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.next',
  '.nuxt', 'vendor', '__pycache__', '.venv', 'venv',
]);

const MANIFESTS = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'docker-compose.yml', 'docker-compose.yaml',
];

interface ProjectSignals {
  frontend: string[];
  backend: string[];
  data: string[];
  tests: string[];
  deployment: string[];
  manifests: string[];
}

export class ProjectMapTool implements Tool {
  name = 'project_map';
  description =
    'Map the whole workspace into a safe architecture summary. Detects frontend, backend/API, data, tests, deployment files, manifests, and proposes a dependency-aware workflow before implementation.';

  inputSchema = {
    type: 'object',
    properties: {
      maxFiles: {
        type: 'number',
        description: 'Maximum source paths to inspect (default: 500)',
      },
    },
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    try {
      const maxFiles = Math.min(Math.max(Number((input as { maxFiles?: number })?.maxFiles) || 500, 50), 2000);
      const files = await this.collectFiles(context.workspaceRoot, maxFiles);
      const signals = this.classify(files);
      const manifestContents = await this.readManifests(context.workspaceRoot, signals.manifests);

      return {
        success: true,
        output: this.formatMap(context.workspaceRoot, files, signals, manifestContents),
        metadata: {
          filesScanned: files.length,
          manifests: signals.manifests,
          areas: Object.entries(signals)
            .filter(([key, values]) => key !== 'manifests' && values.length > 0)
            .map(([key]) => key),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async collectFiles(root: string, maxFiles: number): Promise<string[]> {
    const files: string[] = [];

    const visit = async (directory: string): Promise<void> => {
      if (files.length >= maxFiles) return;
      let entries;
      try {
        entries = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (files.length >= maxFiles) return;
        if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name)) {
          await visit(path.join(directory, entry.name));
        } else if (entry.isFile()) {
          files.push(path.relative(root, path.join(directory, entry.name)));
        }
      }
    };

    await visit(root);
    return files;
  }

  private classify(files: string[]): ProjectSignals {
    const signals: ProjectSignals = {
      frontend: [],
      backend: [],
      data: [],
      tests: [],
      deployment: [],
      manifests: [],
    };

    for (const file of files) {
      const normalized = file.replaceAll('\\', '/');
      const lower = normalized.toLowerCase();
      const base = path.basename(normalized).toLowerCase();

      if (MANIFESTS.includes(base) || base === '.env.example') signals.manifests.push(normalized);
      if (/(^|\/)(src\/)?(app|pages|components|frontend|web|client)(\/|$)|\.(tsx|jsx|vue|svelte)$/.test(lower)) {
        signals.frontend.push(normalized);
      }
      if (/(^|\/)(api|server|backend|routes|controllers|services)(\/|$)|\.(controller|router|route)\./.test(lower)) {
        signals.backend.push(normalized);
      }
      if (/(^|\/)(prisma|migrations?|db|database|models?)(\/|$)|\.(sql|prisma)$/.test(lower)) {
        signals.data.push(normalized);
      }
      if (/(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\./.test(lower)) {
        signals.tests.push(normalized);
      }
      if (/(docker|compose|k8s|kubernetes|terraform|\.github\/workflows|render\.yaml|vercel\.json)/.test(lower)) {
        signals.deployment.push(normalized);
      }
    }

    return signals;
  }

  private async readManifests(root: string, manifests: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const manifest of manifests.slice(0, 12)) {
      if (manifest === '.env.example' || manifest.endsWith('.env')) continue;
      try {
        const content = await fs.readFile(path.join(root, manifest), 'utf-8');
        contents[manifest] = content.slice(0, 8000);
      } catch {
        // A manifest may disappear while the project is being edited.
      }
    }
    return contents;
  }

  private formatMap(
    root: string,
    files: string[],
    signals: ProjectSignals,
    manifests: Record<string, string>
  ): string {
    const area = (name: keyof Omit<ProjectSignals, 'manifests'>): string => {
      const values = signals[name].slice(0, 40);
      return values.length > 0 ? values.map(file => `- ${file}`).join('\n') : '- (not detected)';
    };

    const manifestSummary = Object.entries(manifests)
      .map(([file, content]) => `### ${file}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n');

    return `# Project Map\n\nWorkspace: ${root}\nFiles scanned: ${files.length}\n\n## Architecture signals\n\n### Frontend\n${area('frontend')}\n\n### Backend / API\n${area('backend')}\n\n### Data / persistence\n${area('data')}\n\n### Tests\n${area('tests')}\n\n### Deployment\n${area('deployment')}\n\n## Dependency-aware workflow\n\n1. Confirm the request and inspect the relevant manifest/config without reading secrets.\n2. Trace the affected flow across UI -> API/service -> data -> tests.\n3. Write or update a concise plan and acceptance criteria in the conversation (and .agent/workflow.md when the task is substantial).\n4. Install only the required libraries using the project package manager, with permission and a lockfile update.\n5. Implement the smallest cross-layer change, including validation and error states.\n6. Connect external APIs through environment-based secrets; never hardcode tokens or commit .env.\n7. Run focused tests, typecheck/lint/build, fix failures, then report evidence.\n\n## Manifests\n\n${manifestSummary || '- No supported manifest found.'}`;
  }
}
