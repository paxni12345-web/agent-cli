// Secret Detection and Management System

import * as crypto from 'crypto';

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

export class SecretDetector {
  private patterns: SecretPattern[];
  private whitelist: Set<string>;

  constructor() {
    this.patterns = this.initializePatterns();
    this.whitelist = new Set();
  }

  private initializePatterns(): SecretPattern[] {
    return [
      {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical',
        description: 'AWS Access Key ID',
      },
      {
        name: 'AWS Secret Key',
        pattern: /aws[_\-]?secret[_\-]?access[_\-]?key[\s]*=[\s]*['"]?([0-9a-zA-Z/+=]{40})['"]?/gi,
        severity: 'critical',
        description: 'AWS Secret Access Key',
      },
      {
        name: 'OpenAI API Key',
        pattern: /sk-[a-zA-Z0-9]{48}/g,
        severity: 'critical',
        description: 'OpenAI API Key',
      },
      {
        name: 'Anthropic API Key',
        pattern: /sk-ant-[a-zA-Z0-9\-_]{95,}/g,
        severity: 'critical',
        description: 'Anthropic API Key',
      },
      {
        name: 'GitHub Token',
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        severity: 'critical',
        description: 'GitHub Personal Access Token',
      },
      {
        name: 'Private Key',
        pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
        severity: 'critical',
        description: 'Private SSH/SSL Key',
      },
      {
        name: 'Generic API Key',
        pattern: /api[_\-]?key[\s]*[:=][\s]*['"]?([a-zA-Z0-9\-_]{20,})['"]?/gi,
        severity: 'high',
        description: 'Generic API Key',
      },
      {
        name: 'Password in Code',
        pattern: /password[\s]*[:=][\s]*['"]([^'"]{8,})['"]?/gi,
        severity: 'high',
        description: 'Hardcoded Password',
      },
      {
        name: 'Database Connection String',
        pattern: /(?:mysql|postgresql|mongodb):\/\/[^\s'"]+:[^\s'"]+@/gi,
        severity: 'critical',
        description: 'Database Connection String with Credentials',
      },
      {
        name: 'JWT Token',
        pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
        severity: 'medium',
        description: 'JSON Web Token',
      },
      {
        name: 'Slack Token',
        pattern: /xox[pbar]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/g,
        severity: 'high',
        description: 'Slack Token',
      },
      {
        name: 'Google API Key',
        pattern: /AIza[0-9A-Za-z\-_]{35}/g,
        severity: 'critical',
        description: 'Google API Key',
      },
    ];
  }

  scanText(text: string, location: string = 'unknown'): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];
    const lines = text.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of this.patterns) {
        const matches = line.matchAll(pattern.pattern);

        for (const match of matches) {
          const value = match[0];

          // Skip if whitelisted
          if (this.isWhitelisted(value)) {
            continue;
          }

          // Calculate confidence score
          const confidence = this.calculateConfidence(value, pattern);

          if (confidence > 0.5) {
            secrets.push({
              type: pattern.name,
              location,
              line: lineNum + 1,
              value,
              redacted: this.redactSecret(value),
              severity: pattern.severity,
              confidence,
            });
          }
        }
      }
    }

    return secrets;
  }

  scanFile(filePath: string, content: string): DetectedSecret[] {
    return this.scanText(content, filePath);
  }

  private calculateConfidence(value: string, pattern: SecretPattern): number {
    let confidence = 0.7; // Base confidence

    // Check for entropy (randomness)
    const entropy = this.calculateEntropy(value);
    if (entropy > 4.5) confidence += 0.2;
    if (entropy > 5.0) confidence += 0.1;

    // Check length
    if (value.length >= 32) confidence += 0.1;

    // Penalize if it looks like a placeholder
    const placeholders = ['example', 'test', 'dummy', 'fake', 'sample', 'your-', 'xxx'];
    const lowerValue = value.toLowerCase();
    if (placeholders.some(p => lowerValue.includes(p))) {
      confidence -= 0.4;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: Record<string, number> = {};

    for (let i = 0; i < len; i++) {
      frequencies[str[i]] = (frequencies[str[i]] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private redactSecret(secret: string): string {
    if (secret.length <= 8) {
      return '***';
    }

    const visibleChars = 4;
    const start = secret.substring(0, visibleChars);
    const end = secret.substring(secret.length - visibleChars);

    return `${start}${'*'.repeat(secret.length - visibleChars * 2)}${end}`;
  }

  redactSecrets(text: string): string {
    let redacted = text;

    for (const pattern of this.patterns) {
      redacted = redacted.replace(pattern.pattern, (match) => {
        if (this.isWhitelisted(match)) {
          return match;
        }
        return this.redactSecret(match);
      });
    }

    return redacted;
  }

  addToWhitelist(value: string): void {
    this.whitelist.add(value);
  }

  removeFromWhitelist(value: string): void {
    this.whitelist.delete(value);
  }

  private isWhitelisted(value: string): boolean {
    return this.whitelist.has(value);
  }

  generateReport(secrets: DetectedSecret[]): string {
    if (secrets.length === 0) {
      return '✓ No secrets detected';
    }

    const criticalCount = secrets.filter(s => s.severity === 'critical').length;
    const highCount = secrets.filter(s => s.severity === 'high').length;
    const mediumCount = secrets.filter(s => s.severity === 'medium').length;

    let report = '⚠️  SECRETS DETECTED\n\n';
    report += `Total: ${secrets.length}\n`;
    report += `Critical: ${criticalCount}\n`;
    report += `High: ${highCount}\n`;
    report += `Medium: ${mediumCount}\n\n`;

    report += 'Details:\n';
    for (const secret of secrets) {
      report += `\n[${secret.severity.toUpperCase()}] ${secret.type}\n`;
      report += `  Location: ${secret.location}:${secret.line}\n`;
      report += `  Value: ${secret.redacted}\n`;
      report += `  Confidence: ${(secret.confidence * 100).toFixed(0)}%\n`;
    }

    return report;
  }
}

export class SecretVault {
  private config: SecretVaultConfig;
  private localStore: Map<string, string>;
  private encryptionKey: Buffer;

  constructor(config: SecretVaultConfig) {
    this.config = config;
    this.localStore = new Map();

    // In production, this would come from secure key management
    this.encryptionKey = crypto.randomBytes(32);
  }

  async store(key: string, value: string): Promise<void> {
    switch (this.config.provider) {
      case 'local':
        await this.storeLocal(key, value);
        break;
      case 'aws-secrets-manager':
        await this.storeAWS(key, value);
        break;
      case 'azure-key-vault':
        await this.storeAzure(key, value);
        break;
      case 'hashicorp-vault':
        await this.storeVault(key, value);
        break;
    }
  }

  async retrieve(key: string): Promise<string | null> {
    switch (this.config.provider) {
      case 'local':
        return this.retrieveLocal(key);
      case 'aws-secrets-manager':
        return this.retrieveAWS(key);
      case 'azure-key-vault':
        return this.retrieveAzure(key);
      case 'hashicorp-vault':
        return this.retrieveVault(key);
      default:
        return null;
    }
  }

  async delete(key: string): Promise<void> {
    switch (this.config.provider) {
      case 'local':
        this.localStore.delete(key);
        break;
      // Other providers would have their own delete implementations
    }
  }

  async rotate(key: string, newValue: string): Promise<void> {
    await this.store(key, newValue);
    // In production, this would also update all references
    console.log(`Rotated secret: ${key}`);
  }

  private async storeLocal(key: string, value: string): Promise<void> {
    const encrypted = this.encrypt(value);
    this.localStore.set(key, encrypted);
  }

  private async retrieveLocal(key: string): Promise<string | null> {
    const encrypted = this.localStore.get(key);
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }

  private async storeAWS(key: string, value: string): Promise<void> {
    // In production, use AWS SDK
    console.log(`[AWS Secrets Manager] Storing: ${key}`);
    // await secretsManager.createSecret({ Name: key, SecretString: value });
  }

  private async retrieveAWS(key: string): Promise<string | null> {
    console.log(`[AWS Secrets Manager] Retrieving: ${key}`);
    // const result = await secretsManager.getSecretValue({ SecretId: key });
    // return result.SecretString;
    return null;
  }

  private async storeAzure(key: string, value: string): Promise<void> {
    console.log(`[Azure Key Vault] Storing: ${key}`);
    // Use Azure SDK
  }

  private async retrieveAzure(key: string): Promise<string | null> {
    console.log(`[Azure Key Vault] Retrieving: ${key}`);
    return null;
  }

  private async storeVault(key: string, value: string): Promise<void> {
    console.log(`[HashiCorp Vault] Storing: ${key}`);
    // Use Vault API
  }

  private async retrieveVault(key: string): Promise<string | null> {
    console.log(`[HashiCorp Vault] Retrieving: ${key}`);
    return null;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
    });
  }

  private decrypt(encryptedData: string): string {
    const { iv, data, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  listSecrets(): string[] {
    return Array.from(this.localStore.keys());
  }
}
