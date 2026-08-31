/**
 * PHASE 2: ETL & DATA PIPELINE SYSTEM
 * Extract, Transform, Load with data quality and governance
 *
 * Part of 350K lines goal - PHASE 2
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ETLConfig {
  maxConcurrentPipelines: number;
  defaultBatchSize: number;
  enableDataQuality: boolean;
  enableGovernance: boolean;
  retentionDays: number;
}

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  connection: ConnectionConfig;
  schema?: DataSchema;
  credentials?: Credentials;
  metadata: SourceMetadata;
}

export type DataSourceType =
  | 'database'
  | 'api'
  | 'file'
  | 's3'
  | 'kafka'
  | 'webhook'
  | 'custom';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  url?: string;
  bucket?: string;
  path?: string;
  params?: Record<string, any>;
}

export interface Credentials {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface SourceMetadata {
  region?: string;
  environment: string;
  owner: string;
  tags: string[];
  createdAt: Date;
}

export interface DataSchema {
  tables?: TableSchema[];
  collections?: CollectionSchema[];
  format?: DataFormat;
  fields: FieldSchema[];
}

export type DataFormat = 'json' | 'csv' | 'parquet' | 'avro' | 'xml' | 'protobuf';

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
}

export interface ColumnSchema {
  name: string;
  type: DataType;
  nullable: boolean;
  unique?: boolean;
  defaultValue?: any;
}

export type DataType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'json'
  | 'binary';

export interface ForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface CollectionSchema {
  name: string;
  fields: FieldSchema[];
  indexes?: Index[];
}

export interface FieldSchema {
  name: string;
  type: DataType;
  required: boolean;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: ValidationType;
  value?: any;
  message?: string;
}

export type ValidationType =
  | 'min'
  | 'max'
  | 'pattern'
  | 'enum'
  | 'custom';

export interface Index {
  fields: string[];
  unique: boolean;
  type: IndexType;
}

export type IndexType = 'btree' | 'hash' | 'fulltext';

// ETL Pipeline
export interface ETLPipeline {
  id: string;
  name: string;
  description: string;
  source: DataSource;
  destination: DataSource;
  transformations: Transformation[];
  schedule?: Schedule;
  state: PipelineState;
  lastRun?: PipelineRun;
  config: PipelineConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type PipelineState = 'draft' | 'active' | 'paused' | 'archived';

export interface PipelineConfig {
  batchSize: number;
  parallelism: number;
  errorHandling: ErrorHandling;
  monitoring: MonitoringConfig;
}

export interface ErrorHandling {
  strategy: ErrorStrategy;
  maxRetries: number;
  deadLetterQueue?: string;
}

export type ErrorStrategy = 'fail' | 'skip' | 'retry' | 'quarantine';

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableLogging: boolean;
  alertThreshold: number;
}

export interface Schedule {
  type: ScheduleType;
  expression: string;
  timezone: string;
}

export type ScheduleType = 'cron' | 'interval' | 'manual';

// Transformations
export interface Transformation {
  id: string;
  name: string;
  type: TransformationType;
  config: TransformConfig;
  order: number;
}

export type TransformationType =
  | 'filter'
  | 'map'
  | 'aggregate'
  | 'join'
  | 'pivot'
  | 'unpivot'
  | 'sort'
  | 'deduplicate'
  | 'validate'
  | 'enrich'
  | 'custom';

export interface TransformConfig {
  expression?: string;
  fields?: string[];
  conditions?: Condition[];
  joinType?: JoinType;
  aggregations?: Aggregation[];
  customFunction?: string;
  [key: string]: any;
}

export interface Condition {
  field: string;
  operator: Operator;
  value: any;
}

export type Operator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'regex';

export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross';

export interface Aggregation {
  field: string;
  function: AggregateFunction;
  alias: string;
}

export type AggregateFunction =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'count_distinct'
  | 'first'
  | 'last';

// Pipeline Execution
export interface PipelineRun {
  id: string;
  pipelineId: string;
  state: RunState;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  steps: StepExecution[];
  error?: ExecutionError;
}

export type RunState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepExecution {
  stepId: string;
  name: string;
  state: RunState;
  startedAt: Date;
  completedAt?: Date;
  recordsIn: number;
  recordsOut: number;
  error?: ExecutionError;
}

export interface ExecutionError {
  message: string;
  code: string;
  details?: any;
  stack?: string;
}

// Data Quality
export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  type: QualityRuleType;
  field?: string;
  condition: QualityCondition;
  severity: Severity;
  enabled: boolean;
}

export type QualityRuleType =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'uniqueness'
  | 'timeliness'
  | 'validity';

export interface QualityCondition {
  operator: Operator;
  threshold?: number;
  pattern?: string;
  referenceData?: any;
}

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export interface QualityCheck {
  id: string;
  ruleId: string;
  pipelineRunId: string;
  passed: boolean;
  score: number;
  violations: Violation[];
  checkedAt: Date;
}

export interface Violation {
  recordId: string;
  field: string;
  value: any;
  expectedValue?: any;
  message: string;
}

// Data Governance
export interface DataLineage {
  datasetId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
  transformations: string[];
  lastUpdated: Date;
}

export interface LineageNode {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, any>;
}

export interface DataCatalog {
  id: string;
  name: string;
  description: string;
  schema: DataSchema;
  classification: DataClassification;
  owner: string;
  steward: string;
  tags: string[];
  businessGlossary: GlossaryTerm[];
  qualityScore: number;
  sensitivityLevel: SensitivityLevel;
  retentionPolicy: RetentionPolicy;
}

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export type SensitivityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface GlossaryTerm {
  term: string;
  definition: string;
  synonyms: string[];
  relatedTerms: string[];
}

export interface RetentionPolicy {
  duration: number;
  unit: TimeUnit;
  action: RetentionAction;
}

export type TimeUnit = 'days' | 'months' | 'years';
export type RetentionAction = 'archive' | 'delete' | 'anonymize';

// Change Data Capture
export interface CDCConfig {
  enabled: boolean;
  mode: CDCMode;
  captureDeletes: boolean;
  captureUpdates: boolean;
  batchInterval: number;
}

export type CDCMode = 'log_based' | 'trigger_based' | 'timestamp_based' | 'snapshot';

export interface ChangeEvent {
  id: string;
  operation: ChangeOperation;
  table: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  timestamp: Date;
  metadata: Record<string, any>;
}

export type ChangeOperation = 'insert' | 'update' | 'delete';

// ============================================================================
// ETL Pipeline Manager
// ============================================================================

export class ETLPipelineManager extends EventEmitter {
  private config: ETLConfig;
  private sources: Map<string, DataSource> = new Map();
  private pipelines: Map<string, ETLPipeline> = new Map();
  private runs: Map<string, PipelineRun> = new Map();
  private qualityRules: Map<string, DataQualityRule> = new Map();
  private catalog: Map<string, DataCatalog> = new Map();
  private lineage: Map<string, DataLineage> = new Map();
  private runningPipelines: number = 0;

  constructor(config: Partial<ETLConfig> = {}) {
    super();
    this.config = {
      maxConcurrentPipelines: 10,
      defaultBatchSize: 1000,
      enableDataQuality: true,
      enableGovernance: true,
      retentionDays: 90,
      ...config,
    };
  }

  // ========================================================================
  // Data Source Management
  // ========================================================================

  public registerDataSource(
    name: string,
    type: DataSourceType,
    connection: ConnectionConfig,
    metadata: Partial<SourceMetadata>
  ): DataSource {
    const source: DataSource = {
      id: this.generateId(),
      name,
      type,
      connection,
      metadata: {
        environment: 'production',
        owner: 'system',
        tags: [],
        createdAt: new Date(),
        ...metadata,
      },
    };

    this.sources.set(source.id, source);
    this.emit('source:registered', { sourceId: source.id });

    return source;
  }

  public async discoverSchema(sourceId: string): Promise<DataSchema> {
    const source = this.sources.get(sourceId);

    if (!source) {
      throw new Error('Data source not found');
    }

    // Simulate schema discovery
    const schema: DataSchema = {
      format: 'json',
      fields: [
        { name: 'id', type: 'integer', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'created_at', type: 'timestamp', required: true },
      ],
    };

    source.schema = schema;
    this.emit('schema:discovered', { sourceId, schema });

    return schema;
  }

  // ========================================================================
  // Pipeline Definition
  // ========================================================================

  public createPipeline(
    name: string,
    description: string,
    sourceId: string,
    destinationId: string,
    transformations: Transformation[]
  ): ETLPipeline {
    const source = this.sources.get(sourceId);
    const destination = this.sources.get(destinationId);

    if (!source || !destination) {
      throw new Error('Source or destination not found');
    }

    const pipeline: ETLPipeline = {
      id: this.generateId(),
      name,
      description,
      source,
      destination,
      transformations: transformations.map((t, i) => ({ ...t, order: i })),
      state: 'draft',
      config: {
        batchSize: this.config.defaultBatchSize,
        parallelism: 4,
        errorHandling: {
          strategy: 'retry',
          maxRetries: 3,
        },
        monitoring: {
          enableMetrics: true,
          enableLogging: true,
          alertThreshold: 0.9,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.pipelines.set(pipeline.id, pipeline);
    this.emit('pipeline:created', { pipelineId: pipeline.id });

    return pipeline;
  }

  public schedulePipeline(pipelineId: string, schedule: Schedule): void {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    pipeline.schedule = schedule;
    pipeline.state = 'active';
    pipeline.updatedAt = new Date();

    this.emit('pipeline:scheduled', { pipelineId, schedule });
  }

  // ========================================================================
  // Pipeline Execution
  // ========================================================================

  public async executePipeline(pipelineId: string): Promise<PipelineRun> {
    const pipeline = this.pipelines.get(pipelineId);

    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    if (this.runningPipelines >= this.config.maxConcurrentPipelines) {
      throw new Error('Max concurrent pipelines reached');
    }

    const run: PipelineRun = {
      id: this.generateId(),
      pipelineId,
      state: 'running',
      startedAt: new Date(),
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      steps: [],
    };

    this.runs.set(run.id, run);
    this.runningPipelines++;
    pipeline.lastRun = run;

    this.emit('pipeline:started', { runId: run.id });

    try {
      // Extract
      const extractedData = await this.extractData(pipeline.source, run);

      // Transform
      let transformedData = extractedData;
      for (const transformation of pipeline.transformations.sort((a, b) => a.order - b.order)) {
        transformedData = await this.applyTransformation(transformation, transformedData, run);
      }

      // Data Quality Check
      if (this.config.enableDataQuality) {
        await this.performQualityChecks(transformedData, run);
      }

      // Load
      await this.loadData(pipeline.destination, transformedData, run);

      run.state = 'completed';
      run.completedAt = new Date();
      run.duration = run.completedAt.getTime() - run.startedAt.getTime();

      this.emit('pipeline:completed', { runId: run.id });
    } catch (error) {
      run.state = 'failed';
      run.error = {
        message: (error as Error).message,
        code: 'PIPELINE_ERROR',
      };

      this.emit('pipeline:failed', { runId: run.id, error });
    } finally {
      this.runningPipelines--;
    }

    // Update lineage
    if (this.config.enableGovernance) {
      this.updateLineage(pipeline);
    }

    return run;
  }

  private async extractData(source: DataSource, run: PipelineRun): Promise<any[]> {
    const step: StepExecution = {
      stepId: 'extract',
      name: 'Extract Data',
      state: 'running',
      startedAt: new Date(),
      recordsIn: 0,
      recordsOut: 0,
    };

    run.steps.push(step);
    this.emit('step:started', { runId: run.id, stepId: step.stepId });

    try {
      // Simulate data extraction
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Record ${i}`,
        value: Math.random() * 100,
        timestamp: new Date(),
      }));

      step.recordsOut = data.length;
      run.recordsProcessed += data.length;

      step.state = 'completed';
      step.completedAt = new Date();

      this.emit('step:completed', { runId: run.id, stepId: step.stepId });

      return data;
    } catch (error) {
      step.state = 'failed';
      step.error = {
        message: (error as Error).message,
        code: 'EXTRACT_ERROR',
      };
      throw error;
    }
  }

  private async applyTransformation(
    transformation: Transformation,
    data: any[],
    run: PipelineRun
  ): Promise<any[]> {
    const step: StepExecution = {
      stepId: transformation.id,
      name: transformation.name,
      state: 'running',
      startedAt: new Date(),
      recordsIn: data.length,
      recordsOut: 0,
    };

    run.steps.push(step);

    try {
      let result: any[];

      switch (transformation.type) {
        case 'filter':
          result = this.filterData(data, transformation.config);
          break;
        case 'map':
          result = this.mapData(data, transformation.config);
          break;
        case 'aggregate':
          result = this.aggregateData(data, transformation.config);
          break;
        case 'deduplicate':
          result = this.deduplicateData(data, transformation.config);
          break;
        default:
          result = data;
      }

      step.recordsOut = result.length;
      step.state = 'completed';
      step.completedAt = new Date();

      return result;
    } catch (error) {
      step.state = 'failed';
      step.error = {
        message: (error as Error).message,
        code: 'TRANSFORM_ERROR',
      };
      throw error;
    }
  }

  private filterData(data: any[], config: TransformConfig): any[] {
    if (!config.conditions) return data;

    return data.filter(record => {
      return config.conditions!.every(condition => {
        const value = record[condition.field];

        switch (condition.operator) {
          case 'equals':
            return value === condition.value;
          case 'greater_than':
            return value > condition.value;
          case 'less_than':
            return value < condition.value;
          case 'contains':
            return String(value).includes(condition.value);
          default:
            return true;
        }
      });
    });
  }

  private mapData(data: any[], config: TransformConfig): any[] {
    if (!config.fields) return data;

    return data.map(record => {
      const mapped: Record<string, any> = {};

      for (const field of config.fields!) {
        mapped[field] = record[field];
      }

      return mapped;
    });
  }

  private aggregateData(data: any[], config: TransformConfig): any[] {
    if (!config.aggregations) return data;

    const result: Record<string, any> = {};

    for (const agg of config.aggregations) {
      const values = data.map(r => r[agg.field]).filter(v => v !== undefined);

      switch (agg.function) {
        case 'sum':
          result[agg.alias] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          result[agg.alias] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          result[agg.alias] = Math.min(...values);
          break;
        case 'max':
          result[agg.alias] = Math.max(...values);
          break;
        case 'count':
          result[agg.alias] = values.length;
          break;
        case 'count_distinct':
          result[agg.alias] = new Set(values).size;
          break;
      }
    }

    return [result];
  }

  private deduplicateData(data: any[], config: TransformConfig): any[] {
    const seen = new Set();
    const key = config.fields ? config.fields[0] : 'id';

    return data.filter(record => {
      const value = record[key];

      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
  }

  private async loadData(destination: DataSource, data: any[], run: PipelineRun): Promise<void> {
    const step: StepExecution = {
      stepId: 'load',
      name: 'Load Data',
      state: 'running',
      startedAt: new Date(),
      recordsIn: data.length,
      recordsOut: 0,
    };

    run.steps.push(step);

    try {
      // Simulate data loading
      step.recordsOut = data.length;
      run.recordsSucceeded += data.length;

      step.state = 'completed';
      step.completedAt = new Date();

      this.emit('step:completed', { runId: run.id, stepId: step.stepId });
    } catch (error) {
      step.state = 'failed';
      throw error;
    }
  }

  // ========================================================================
  // Data Quality
  // ========================================================================

  public createQualityRule(rule: Omit<DataQualityRule, 'id'>): DataQualityRule {
    const qualityRule: DataQualityRule = {
      id: this.generateId(),
      ...rule,
    };

    this.qualityRules.set(qualityRule.id, qualityRule);
    this.emit('quality_rule:created', { ruleId: qualityRule.id });

    return qualityRule;
  }

  private async performQualityChecks(data: any[], run: PipelineRun): Promise<void> {
    const enabledRules = Array.from(this.qualityRules.values()).filter(r => r.enabled);

    for (const rule of enabledRules) {
      const check = this.executeQualityRule(rule, data, run.id);

      if (!check.passed && rule.severity === 'critical') {
        throw new Error(`Critical quality check failed: ${rule.name}`);
      }
    }
  }

  private executeQualityRule(
    rule: DataQualityRule,
    data: any[],
    runId: string
  ): QualityCheck {
    const violations: Violation[] = [];
    let passedCount = 0;

    for (const record of data) {
      let passed = true;

      if (rule.field) {
        const value = record[rule.field];

        switch (rule.type) {
          case 'completeness':
            passed = value !== null && value !== undefined && value !== '';
            break;
          case 'uniqueness':
            // Would check against all records
            break;
          case 'validity':
            if (rule.condition.pattern) {
              passed = new RegExp(rule.condition.pattern).test(String(value));
            }
            break;
        }
      }

      if (passed) {
        passedCount++;
      } else {
        violations.push({
          recordId: record.id || 'unknown',
          field: rule.field || 'unknown',
          value,
          message: `Failed ${rule.type} check`,
        });
      }
    }

    const score = data.length > 0 ? passedCount / data.length : 1;
    const passed = score >= (rule.condition.threshold || 0.95);

    const check: QualityCheck = {
      id: this.generateId(),
      ruleId: rule.id,
      pipelineRunId: runId,
      passed,
      score,
      violations,
      checkedAt: new Date(),
    };

    this.emit('quality:checked', { checkId: check.id, passed });

    return check;
  }

  // ========================================================================
  // Data Governance
  // ========================================================================

  public catalogDataset(catalog: Omit<DataCatalog, 'id'>): DataCatalog {
    const entry: DataCatalog = {
      id: this.generateId(),
      ...catalog,
    };

    this.catalog.set(entry.id, entry);
    this.emit('dataset:cataloged', { catalogId: entry.id });

    return entry;
  }

  private updateLineage(pipeline: ETLPipeline): void {
    const lineage: DataLineage = {
      datasetId: pipeline.destination.id,
      upstream: [
        {
          id: pipeline.source.id,
          name: pipeline.source.name,
          type: pipeline.source.type,
          metadata: {},
        },
      ],
      downstream: [],
      transformations: pipeline.transformations.map(t => t.name),
      lastUpdated: new Date(),
    };

    this.lineage.set(pipeline.destination.id, lineage);
    this.emit('lineage:updated', { datasetId: pipeline.destination.id });
  }

  public getLineage(datasetId: string): DataLineage | undefined {
    return this.lineage.get(datasetId);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateId(): string {
    return `etl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  public getStats() {
    return {
      dataSources: this.sources.size,
      pipelines: this.pipelines.size,
      activePipelines: Array.from(this.pipelines.values()).filter(p => p.state === 'active')
        .length,
      runs: this.runs.size,
      runningPipelines: this.runningPipelines,
      qualityRules: this.qualityRules.size,
      catalogEntries: this.catalog.size,
      lineageEntries: this.lineage.size,
    };
  }
}
