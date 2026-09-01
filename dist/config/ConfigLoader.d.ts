import { Config } from '../types/index.js';
export declare class ConfigLoader {
    private static readonly DEFAULT_CONFIG;
    load(): Promise<Config>;
    private loadGlobalConfig;
    private loadProjectConfig;
    private applyEnvironmentVariables;
    save(config: Partial<Config>, global?: boolean): Promise<void>;
    getApiKey(config: Config): string | undefined;
}
//# sourceMappingURL=ConfigLoader.d.ts.map