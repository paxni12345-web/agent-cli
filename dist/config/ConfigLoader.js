"use strict";
// Configuration Management
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
exports.ConfigLoader = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ConfigLoader {
    static DEFAULT_CONFIG = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'normal',
        maxIterations: 30,
        temperature: 0.7,
        workspaceRoot: process.cwd(),
        debug: false,
    };
    async load() {
        const config = { ...ConfigLoader.DEFAULT_CONFIG };
        // Load from global config
        const globalConfig = await this.loadGlobalConfig();
        Object.assign(config, globalConfig);
        // Load from project config
        const projectConfig = await this.loadProjectConfig(config.workspaceRoot);
        Object.assign(config, projectConfig);
        // Override with environment variables
        this.applyEnvironmentVariables(config);
        return config;
    }
    async loadGlobalConfig() {
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
            const configPath = path.join(homeDir, '.agent', 'config.json');
            const content = await fs.readFile(configPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return {};
        }
    }
    async loadProjectConfig(workspaceRoot) {
        try {
            const configPath = path.join(workspaceRoot, '.agent', 'config.json');
            const content = await fs.readFile(configPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return {};
        }
    }
    applyEnvironmentVariables(config) {
        if (process.env.AGENT_MODEL) {
            config.model = process.env.AGENT_MODEL;
        }
        if (process.env.AGENT_PROVIDER) {
            config.provider = process.env.AGENT_PROVIDER;
        }
        if (process.env.AGENT_API_KEY) {
            config.apiKey = process.env.AGENT_API_KEY;
        }
        if (process.env.AGENT_BASE_URL) {
            config.baseUrl = process.env.AGENT_BASE_URL;
        }
        if (process.env.AGENT_PERMISSION_MODE) {
            config.permissionMode = process.env.AGENT_PERMISSION_MODE;
        }
        if (process.env.AGENT_MAX_ITERATIONS) {
            config.maxIterations = parseInt(process.env.AGENT_MAX_ITERATIONS, 10);
        }
        if (process.env.AGENT_DEBUG) {
            config.debug = process.env.AGENT_DEBUG === 'true';
        }
    }
    async save(config, global = true) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
        const configDir = global
            ? path.join(homeDir, '.agent')
            : path.join(config.workspaceRoot || process.cwd(), '.agent');
        await fs.mkdir(configDir, { recursive: true });
        const configPath = path.join(configDir, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    getApiKey(config) {
        // Priority: config.apiKey > environment variable > undefined
        if (config.apiKey) {
            return config.apiKey;
        }
        if (config.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
            return process.env.ANTHROPIC_API_KEY;
        }
        if (config.provider === 'openai' && process.env.OPENAI_API_KEY) {
            return process.env.OPENAI_API_KEY;
        }
        return undefined;
    }
}
exports.ConfigLoader = ConfigLoader;
