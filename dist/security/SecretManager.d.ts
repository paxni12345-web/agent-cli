export interface SecretPattern {
    name: string;
    pattern: RegExp;
    severity: 'critical' | 'high' | 'medium';
    description: string;
}
export interface DetectedSecret {
    type: string;
    location: string;
    line: number;
    value: string;
    redacted: string;
    severity: 'critical' | 'high' | 'medium';
    confidence: number;
}
export interface SecretVaultConfig {
    provider: 'aws-secrets-manager' | 'azure-key-vault' | 'hashicorp-vault' | 'local';
    region?: string;
    vaultUrl?: string;
    credentials?: {
        accessKeyId?: string;
        secretAccessKey?: string;
    };
}
export declare class SecretDetector {
    private patterns;
    private whitelist;
    constructor();
    private initializePatterns;
    scanText(text: string, location?: string): DetectedSecret[];
    scanFile(filePath: string, content: string): DetectedSecret[];
    private calculateConfidence;
    private calculateEntropy;
    private redactSecret;
    redactSecrets(text: string): string;
    addToWhitelist(value: string): void;
    removeFromWhitelist(value: string): void;
    private isWhitelisted;
    generateReport(secrets: DetectedSecret[]): string;
}
export declare class SecretVault {
    private config;
    private localStore;
    private encryptionKey;
    constructor(config: SecretVaultConfig);
    store(key: string, value: string): Promise<void>;
    retrieve(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    rotate(key: string, newValue: string): Promise<void>;
    private storeLocal;
    private retrieveLocal;
    private storeAWS;
    private retrieveAWS;
    private storeAzure;
    private retrieveAzure;
    private storeVault;
    private retrieveVault;
    private encrypt;
    private decrypt;
    listSecrets(): string[];
}
//# sourceMappingURL=SecretManager.d.ts.map