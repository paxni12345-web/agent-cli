/**
 * Data Pipeline and ETL System
 * Extract, Transform, Load operations with data validation and quality checks
 */

import { eventBus } from '../core/EventBus';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  source: DataSource;
  transforms: Transform[];
  destination: DataDestination;
  schedule?: PipelineSchedule;
  config: PipelineConfig;
  status: PipelineStatus;
  metrics: PipelineMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSource {
  type: SourceType;
  config: SourceConfig;
  schema?: DataSchema;
}

export enum SourceType {
  Database = 'database',
  File = 'file',
  API = 'api',
  Stream = 'stream',
  Queue = 'queue',
}

export interface SourceConfig {
  [key: string]: any;
}

export interface DataSchema {
  fields: SchemaField[];
  primaryKey?: string[];
  indexes?: Index[];
}

export interface SchemaField {
  name: string;
  type: FieldType;
  nullable: boolean;
  defaultValue?: any;
  constraints?: FieldConstraint[];
}

export enum FieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Object = 'object',
  Array = 'array',
}

export interface FieldConstraint {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
}

export interface Index {
  name: string;
  fields: string[];
  unique: boolean;
}

export interface Transform {
  id: string;
  name: string;
  type: TransformType;
  config: TransformConfig;
  enabled: boolean;
  order: number;
}

export enum TransformType {
  Map = 'map',
  Filter = 'filter',
  Aggregate = 'aggregate',
  Join = 'join',
  Sort = 'sort',
  Deduplicate = 'deduplicate',
  Validate = 'validate',
  Enrich = 'enrich',
  Split = 'split',
  Merge = 'merge',
}

export interface TransformConfig {
  [key: string]: any;
}

export interface DataDestination {
  type: DestinationType;
  config: DestinationConfig;
  schema?: DataSchema;
}

export enum DestinationType {
  Database = 'database',
  File = 'file',
  API = 'api',
  Stream = 'stream',
  Queue = 'queue',
}

export interface DestinationConfig {
  [key: string]: any;
}

export interface PipelineSchedule {
  type: 'cron' | 'interval' | 'event';
  expression?: string;
  interval?: number;
  eventType?: string;
}

export interface PipelineConfig {
  batchSize: number;
  parallelism: number;
  retryPolicy: RetryPolicy;
  errorHandling: ErrorHandling;
  logging: LoggingConfig;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  delay: number;
}

export interface ErrorHandling {
  strategy: 'stop' | 'skip' | 'deadletter';
  deadLetterQueue?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  destination: 'console' | 'file' | 'database';
}

export enum PipelineStatus {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
  Failed = 'failed',
  Completed = 'completed',
}

export interface PipelineMetrics {
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  averageLatency: number;
  throughput: number;
  lastRun?: Date;
  runCount: number;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: PipelineStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metrics: RunMetrics;
  errors: PipelineError[];
}

export interface RunMetrics {
  recordsRead: number;
  recordsWritten: number;
  recordsFailed: number;
  recordsSkipped: number;
  bytesRead: number;
  bytesWritten: number;
}

export interface PipelineError {
  recordId?: string;
  stage: string;
  error: string;
  timestamp: Date;
  data?: any;
}

export interface DataQualityRule {
  id: string;
  name: string;
  type: QualityRuleType;
  field?: string;
  condition: QualityCondition;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export enum QualityRuleType {
  NotNull = 'not_null',
  Unique = 'unique',
  Range = 'range',
  Pattern = 'pattern',
  Enum = 'enum',
  Custom = 'custom',
}

export interface QualityCondition {
  type: string;
  value: any;
}

export interface DataQualityReport {
  pipelineId: string;
  runId: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  violations: QualityViolation[];
  timestamp: Date;
}

export interface QualityViolation {
  ruleId: string;
  ruleName: string;
  recordId?: string;
  field?: string;
  value?: any;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * ETL Pipeline Manager
 */
export class ETLPipelineManager {
  private pipelines: Map<string, Pipeline> = new Map();
  private runs: Map<string, PipelineRun> = new Map();
  private qualityRules: Map<string, DataQualityRule[]> = new Map();

  /**
   * Create pipeline
   */
  createPipeline(pipeline: Omit<Pipeline, 'id' | 'status' | 'metrics' | 'createdAt' | 'updatedAt'>): Pipeline {
    const fullPipeline: Pipeline = {
      ...pipeline,
      id: this.generatePipelineId(),
      status: PipelineStatus.Idle,
      metrics: {
        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
        averageLatency: 0,
        throughput: 0,
        runCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.pipelines.set(fullPipeline.id, fullPipeline);

    eventBus.emitSync('pipeline.created', fullPipeline, 'ETLPipelineManager');

    return fullPipeline;
  }

  /**
   * Run pipeline
   */
  async runPipeline(pipelineId: string): Promise<PipelineRun> {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    if (pipeline.status === PipelineStatus.Running) {
      throw new Error(`Pipeline is already running: ${pipelineId}`);
    }

    const run: PipelineRun = {
      id: this.generateRunId(),
      pipelineId,
      status: PipelineStatus.Running,
      startedAt: new Date(),
      metrics: {
        recordsRead: 0,
        recordsWritten: 0,
        recordsFailed: 0,
        recordsSkipped: 0,
        bytesRead: 0,
        bytesWritten: 0,
      },
      errors: [],
    };

    this.runs.set(run.id, run);
    pipeline.status = PipelineStatus.Running;

    eventBus.emitSync('pipeline.run_started', run, 'ETLPipelineManager');

    // Execute pipeline
    this.executePipeline(pipeline, run);

    return run;
  }

  /**
   * Stop pipeline
   */
  stopPipeline(pipelineId: string): void {
    const pipeline = this.pipelines.get(pipelineId);

    if (pipeline) {
      pipeline.status = PipelineStatus.Paused;
      eventBus.emitSync('pipeline.stopped', { pipelineId }, 'ETLPipelineManager');
    }
  }

  /**
   * Get pipeline
   */
  getPipeline(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  /**
   * List pipelines
   */
  listPipelines(filter?: { status?: PipelineStatus }): Pipeline[] {
    let pipelines = Array.from(this.pipelines.values());

    if (filter?.status) {
      pipelines = pipelines.filter(p => p.status === filter.status);
    }

    return pipelines;
  }

  /**
   * Get pipeline run
   */
  getRun(runId: string): PipelineRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * List pipeline runs
   */
  listRuns(pipelineId?: string): PipelineRun[] {
    let runs = Array.from(this.runs.values());

    if (pipelineId) {
      runs = runs.filter(r => r.pipelineId === pipelineId);
    }

    return runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Add quality rule
   */
  addQualityRule(pipelineId: string, rule: DataQualityRule): void {
    if (!this.qualityRules.has(pipelineId)) {
      this.qualityRules.set(pipelineId, []);
    }

    this.qualityRules.get(pipelineId)!.push(rule);
  }

  /**
   * Validate data quality
   */
  async validateQuality(pipelineId: string, runId: string, records: any[]): Promise<DataQualityReport> {
    const rules = this.qualityRules.get(pipelineId) || [];
    const violations: QualityViolation[] = [];

    for (const record of records) {
      for (const rule of rules) {
        if (!rule.enabled) continue;

        const violation = this.checkRule(rule, record);

        if (violation) {
          violations.push(violation);
        }
      }
    }

    return {
      pipelineId,
      runId,
      totalRecords: records.length,
      validRecords: records.length - violations.filter(v => v.severity === 'error').length,
      invalidRecords: violations.filter(v => v.severity === 'error').length,
      violations,
      timestamp: new Date(),
    };
  }

  /**
   * Execute pipeline
   */
  private async executePipeline(pipeline: Pipeline, run: PipelineRun): Promise<void> {
    try {
      // Extract
      const data = await this.extract(pipeline.source, run);

      // Transform
      let transformedData = data;

      for (const transform of pipeline.transforms.filter(t => t.enabled).sort((a, b) => a.order - b.order)) {
        transformedData = await this.transform(transform, transformedData, run);
      }

      // Validate quality
      if (this.qualityRules.has(pipeline.id)) {
        const qualityReport = await this.validateQuality(pipeline.id, run.id, transformedData);

        if (qualityReport.invalidRecords > 0 && pipeline.config.errorHandling.strategy === 'stop') {
          throw new Error(`Data quality validation failed: ${qualityReport.invalidRecords} invalid records`);
        }
      }

      // Load
      await this.load(pipeline.destination, transformedData, run);

      // Complete run
      run.status = PipelineStatus.Completed;
      run.completedAt = new Date();
      run.duration = run.completedAt.getTime() - run.startedAt.getTime();

      pipeline.status = PipelineStatus.Idle;
      pipeline.metrics.runCount++;
      pipeline.metrics.lastRun = new Date();

      eventBus.emitSync('pipeline.run_completed', run, 'ETLPipelineManager');
    } catch (error) {
      run.status = PipelineStatus.Failed;
      run.completedAt = new Date();
      run.duration = run.completedAt.getTime() - run.startedAt.getTime();

      run.errors.push({
        stage: 'pipeline',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });

      pipeline.status = PipelineStatus.Failed;

      eventBus.emitSync('pipeline.run_failed', run, 'ETLPipelineManager');
    }
  }

  /**
   * Extract data
   */
  private async extract(source: DataSource, run: PipelineRun): Promise<any[]> {
    // Mock implementation
    const data: any[] = [];

    run.metrics.recordsRead = data.length;

    return data;
  }

  /**
   * Transform data
   */
  private async transform(transform: Transform, data: any[], run: PipelineRun): Promise<any[]> {
    switch (transform.type) {
      case TransformType.Map:
        return this.transformMap(data, transform.config);

      case TransformType.Filter:
        return this.transformFilter(data, transform.config);

      case TransformType.Aggregate:
        return this.transformAggregate(data, transform.config);

      case TransformType.Sort:
        return this.transformSort(data, transform.config);

      case TransformType.Deduplicate:
        return this.transformDeduplicate(data, transform.config);

      default:
        return data;
    }
  }

  private transformMap(data: any[], config: TransformConfig): any[] {
    if (config.mapping) {
      return data.map(record => {
        const mapped: any = {};

        for (const [targetField, sourceField] of Object.entries(config.mapping)) {
          mapped[targetField] = record[sourceField];
        }

        return mapped;
      });
    }

    return data;
  }

  private transformFilter(data: any[], config: TransformConfig): any[] {
    if (config.condition) {
      return data.filter(record => {
        // Simple condition evaluation
        return true;
      });
    }

    return data;
  }

  private transformAggregate(data: any[], config: TransformConfig): any[] {
    if (!config.groupBy || !config.aggregations) {
      return data;
    }

    const groups = new Map<string, any[]>();

    // Group data
    for (const record of data) {
      const key = config.groupBy.map((field: string) => record[field]).join('|');

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(record);
    }

    // Aggregate
    const result: any[] = [];

    for (const [key, records] of groups) {
      const aggregated: any = {};

      // Add group by fields
      const keyParts = key.split('|');
      config.groupBy.forEach((field: string, index: number) => {
        aggregated[field] = keyParts[index];
      });

      // Add aggregations
      for (const [targetField, agg] of Object.entries(config.aggregations)) {
        const aggConfig = agg as any;

        switch (aggConfig.function) {
          case 'count':
            aggregated[targetField] = records.length;
            break;

          case 'sum':
            aggregated[targetField] = records.reduce((sum, r) => sum + r[aggConfig.field], 0);
            break;

          case 'avg':
            aggregated[targetField] = records.reduce((sum, r) => sum + r[aggConfig.field], 0) / records.length;
            break;

          case 'min':
            aggregated[targetField] = Math.min(...records.map(r => r[aggConfig.field]));
            break;

          case 'max':
            aggregated[targetField] = Math.max(...records.map(r => r[aggConfig.field]));
            break;
        }
      }

      result.push(aggregated);
    }

    return result;
  }

  private transformSort(data: any[], config: TransformConfig): any[] {
    if (!config.fields) {
      return data;
    }

    return [...data].sort((a, b) => {
      for (const field of config.fields) {
        const fieldName = typeof field === 'string' ? field : field.name;
        const order = typeof field === 'string' ? 'asc' : field.order || 'asc';

        if (a[fieldName] < b[fieldName]) {
          return order === 'asc' ? -1 : 1;
        }

        if (a[fieldName] > b[fieldName]) {
          return order === 'asc' ? 1 : -1;
        }
      }

      return 0;
    });
  }

  private transformDeduplicate(data: any[], config: TransformConfig): any[] {
    if (!config.keys) {
      return data;
    }

    const seen = new Set<string>();
    const result: any[] = [];

    for (const record of data) {
      const key = config.keys.map((field: string) => record[field]).join('|');

      if (!seen.has(key)) {
        seen.add(key);
        result.push(record);
      }
    }

    return result;
  }

  /**
   * Load data
   */
  private async load(destination: DataDestination, data: any[], run: PipelineRun): Promise<void> {
    // Mock implementation
    run.metrics.recordsWritten = data.length;
  }

  private checkRule(rule: DataQualityRule, record: any): QualityViolation | null {
    switch (rule.type) {
      case QualityRuleType.NotNull:
        if (rule.field && (record[rule.field] === null || record[rule.field] === undefined)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            field: rule.field,
            value: record[rule.field],
            message: `Field ${rule.field} is null`,
            severity: rule.severity,
          };
        }
        break;

      case QualityRuleType.Unique:
        // Would need to track seen values
        break;

      case QualityRuleType.Range:
        if (rule.field && rule.condition.value) {
          const value = record[rule.field];
          const { min, max } = rule.condition.value;

          if (value < min || value > max) {
            return {
              ruleId: rule.id,
              ruleName: rule.name,
              field: rule.field,
              value,
              message: `Field ${rule.field} is out of range [${min}, ${max}]`,
              severity: rule.severity,
            };
          }
        }
        break;

      case QualityRuleType.Pattern:
        if (rule.field && rule.condition.value) {
          const value = String(record[rule.field]);
          const pattern = new RegExp(rule.condition.value);

          if (!pattern.test(value)) {
            return {
              ruleId: rule.id,
              ruleName: rule.name,
              field: rule.field,
              value,
              message: `Field ${rule.field} does not match pattern`,
              severity: rule.severity,
            };
          }
        }
        break;
    }

    return null;
  }

  private generatePipelineId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Data Validator
 */
export class DataValidator {
  /**
   * Validate against schema
   */
  validate(data: any, schema: DataSchema): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of schema.fields) {
      const value = data[field.name];

      // Check nullable
      if (!field.nullable && (value === null || value === undefined)) {
        errors.push({
          field: field.name,
          message: `Field is required`,
          value,
        });

        continue;
      }

      // Check type
      if (value !== null && value !== undefined) {
        const typeValid = this.validateType(value, field.type);

        if (!typeValid) {
          errors.push({
            field: field.name,
            message: `Invalid type, expected ${field.type}`,
            value,
          });
        }

        // Check constraints
        if (field.constraints) {
          for (const constraint of field.constraints) {
            const constraintError = this.validateConstraint(value, constraint);

            if (constraintError) {
              errors.push({
                field: field.name,
                message: constraintError,
                value,
              });
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateType(value: any, type: FieldType): boolean {
    switch (type) {
      case FieldType.String:
        return typeof value === 'string';
      case FieldType.Number:
        return typeof value === 'number';
      case FieldType.Boolean:
        return typeof value === 'boolean';
      case FieldType.Date:
        return value instanceof Date;
      case FieldType.Object:
        return typeof value === 'object' && !Array.isArray(value);
      case FieldType.Array:
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private validateConstraint(value: any, constraint: FieldConstraint): string | null {
    switch (constraint.type) {
      case 'min':
        if (typeof value === 'number' && value < constraint.value) {
          return `Value must be at least ${constraint.value}`;
        }

        if (typeof value === 'string' && value.length < constraint.value) {
          return `Length must be at least ${constraint.value}`;
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > constraint.value) {
          return `Value must be at most ${constraint.value}`;
        }

        if (typeof value === 'string' && value.length > constraint.value) {
          return `Length must be at most ${constraint.value}`;
        }
        break;

      case 'pattern':
        if (typeof value === 'string') {
          const pattern = new RegExp(constraint.value);

          if (!pattern.test(value)) {
            return `Value does not match pattern`;
          }
        }
        break;

      case 'enum':
        if (!constraint.value.includes(value)) {
          return `Value must be one of: ${constraint.value.join(', ')}`;
        }
        break;
    }

    return null;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

/**
 * Singleton instances
 */
export const etlPipelineManager = new ETLPipelineManager();
export const dataValidator = new DataValidator();
