"use strict";
/**
 * Data Pipeline and ETL System
 * Extract, Transform, Load operations with data validation and quality checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataValidator = exports.etlPipelineManager = exports.DataValidator = exports.ETLPipelineManager = exports.QualityRuleType = exports.PipelineStatus = exports.DestinationType = exports.TransformType = exports.FieldType = exports.SourceType = void 0;
const EventBus_1 = require("../core/EventBus");
var SourceType;
(function (SourceType) {
    SourceType["Database"] = "database";
    SourceType["File"] = "file";
    SourceType["API"] = "api";
    SourceType["Stream"] = "stream";
    SourceType["Queue"] = "queue";
})(SourceType || (exports.SourceType = SourceType = {}));
var FieldType;
(function (FieldType) {
    FieldType["String"] = "string";
    FieldType["Number"] = "number";
    FieldType["Boolean"] = "boolean";
    FieldType["Date"] = "date";
    FieldType["Object"] = "object";
    FieldType["Array"] = "array";
})(FieldType || (exports.FieldType = FieldType = {}));
var TransformType;
(function (TransformType) {
    TransformType["Map"] = "map";
    TransformType["Filter"] = "filter";
    TransformType["Aggregate"] = "aggregate";
    TransformType["Join"] = "join";
    TransformType["Sort"] = "sort";
    TransformType["Deduplicate"] = "deduplicate";
    TransformType["Validate"] = "validate";
    TransformType["Enrich"] = "enrich";
    TransformType["Split"] = "split";
    TransformType["Merge"] = "merge";
})(TransformType || (exports.TransformType = TransformType = {}));
var DestinationType;
(function (DestinationType) {
    DestinationType["Database"] = "database";
    DestinationType["File"] = "file";
    DestinationType["API"] = "api";
    DestinationType["Stream"] = "stream";
    DestinationType["Queue"] = "queue";
})(DestinationType || (exports.DestinationType = DestinationType = {}));
var PipelineStatus;
(function (PipelineStatus) {
    PipelineStatus["Idle"] = "idle";
    PipelineStatus["Running"] = "running";
    PipelineStatus["Paused"] = "paused";
    PipelineStatus["Failed"] = "failed";
    PipelineStatus["Completed"] = "completed";
})(PipelineStatus || (exports.PipelineStatus = PipelineStatus = {}));
var QualityRuleType;
(function (QualityRuleType) {
    QualityRuleType["NotNull"] = "not_null";
    QualityRuleType["Unique"] = "unique";
    QualityRuleType["Range"] = "range";
    QualityRuleType["Pattern"] = "pattern";
    QualityRuleType["Enum"] = "enum";
    QualityRuleType["Custom"] = "custom";
})(QualityRuleType || (exports.QualityRuleType = QualityRuleType = {}));
/**
 * ETL Pipeline Manager
 */
class ETLPipelineManager {
    pipelines = new Map();
    runs = new Map();
    qualityRules = new Map();
    /**
     * Create pipeline
     */
    createPipeline(pipeline) {
        const fullPipeline = {
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
        EventBus_1.eventBus.emitSync('pipeline.created', fullPipeline, 'ETLPipelineManager');
        return fullPipeline;
    }
    /**
     * Run pipeline
     */
    async runPipeline(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline not found: ${pipelineId}`);
        }
        if (pipeline.status === PipelineStatus.Running) {
            throw new Error(`Pipeline is already running: ${pipelineId}`);
        }
        const run = {
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
        EventBus_1.eventBus.emitSync('pipeline.run_started', run, 'ETLPipelineManager');
        // Execute pipeline
        this.executePipeline(pipeline, run);
        return run;
    }
    /**
     * Stop pipeline
     */
    stopPipeline(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (pipeline) {
            pipeline.status = PipelineStatus.Paused;
            EventBus_1.eventBus.emitSync('pipeline.stopped', { pipelineId }, 'ETLPipelineManager');
        }
    }
    /**
     * Get pipeline
     */
    getPipeline(pipelineId) {
        return this.pipelines.get(pipelineId);
    }
    /**
     * List pipelines
     */
    listPipelines(filter) {
        let pipelines = Array.from(this.pipelines.values());
        if (filter?.status) {
            pipelines = pipelines.filter(p => p.status === filter.status);
        }
        return pipelines;
    }
    /**
     * Get pipeline run
     */
    getRun(runId) {
        return this.runs.get(runId);
    }
    /**
     * List pipeline runs
     */
    listRuns(pipelineId) {
        let runs = Array.from(this.runs.values());
        if (pipelineId) {
            runs = runs.filter(r => r.pipelineId === pipelineId);
        }
        return runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
    /**
     * Add quality rule
     */
    addQualityRule(pipelineId, rule) {
        if (!this.qualityRules.has(pipelineId)) {
            this.qualityRules.set(pipelineId, []);
        }
        this.qualityRules.get(pipelineId).push(rule);
    }
    /**
     * Validate data quality
     */
    async validateQuality(pipelineId, runId, records) {
        const rules = this.qualityRules.get(pipelineId) || [];
        const violations = [];
        for (const record of records) {
            for (const rule of rules) {
                if (!rule.enabled)
                    continue;
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
    async executePipeline(pipeline, run) {
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
            EventBus_1.eventBus.emitSync('pipeline.run_completed', run, 'ETLPipelineManager');
        }
        catch (error) {
            run.status = PipelineStatus.Failed;
            run.completedAt = new Date();
            run.duration = run.completedAt.getTime() - run.startedAt.getTime();
            run.errors.push({
                stage: 'pipeline',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            });
            pipeline.status = PipelineStatus.Failed;
            EventBus_1.eventBus.emitSync('pipeline.run_failed', run, 'ETLPipelineManager');
        }
    }
    /**
     * Extract data
     */
    async extract(source, run) {
        // Mock implementation
        const data = [];
        run.metrics.recordsRead = data.length;
        return data;
    }
    /**
     * Transform data
     */
    async transform(transform, data, run) {
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
    transformMap(data, config) {
        if (config.mapping) {
            return data.map(record => {
                const mapped = {};
                for (const [targetField, sourceField] of Object.entries(config.mapping)) {
                    mapped[targetField] = record[sourceField];
                }
                return mapped;
            });
        }
        return data;
    }
    transformFilter(data, config) {
        if (config.condition) {
            return data.filter(record => {
                // Simple condition evaluation
                return true;
            });
        }
        return data;
    }
    transformAggregate(data, config) {
        if (!config.groupBy || !config.aggregations) {
            return data;
        }
        const groups = new Map();
        // Group data
        for (const record of data) {
            const key = config.groupBy.map((field) => record[field]).join('|');
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(record);
        }
        // Aggregate
        const result = [];
        for (const [key, records] of groups) {
            const aggregated = {};
            // Add group by fields
            const keyParts = key.split('|');
            config.groupBy.forEach((field, index) => {
                aggregated[field] = keyParts[index];
            });
            // Add aggregations
            for (const [targetField, agg] of Object.entries(config.aggregations)) {
                const aggConfig = agg;
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
    transformSort(data, config) {
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
    transformDeduplicate(data, config) {
        if (!config.keys) {
            return data;
        }
        const seen = new Set();
        const result = [];
        for (const record of data) {
            const key = config.keys.map((field) => record[field]).join('|');
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
    async load(destination, data, run) {
        // Mock implementation
        run.metrics.recordsWritten = data.length;
    }
    checkRule(rule, record) {
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
    generatePipelineId() {
        return `pipeline_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateRunId() {
        return `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ETLPipelineManager = ETLPipelineManager;
/**
 * Data Validator
 */
class DataValidator {
    /**
     * Validate against schema
     */
    validate(data, schema) {
        const errors = [];
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
    validateType(value, type) {
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
    validateConstraint(value, constraint) {
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
exports.DataValidator = DataValidator;
/**
 * Singleton instances
 */
exports.etlPipelineManager = new ETLPipelineManager();
exports.dataValidator = new DataValidator();
