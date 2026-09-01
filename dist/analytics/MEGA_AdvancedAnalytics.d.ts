/**
 * MEGA PHASE 27: ADVANCED ANALYTICS & BUSINESS INTELLIGENCE
 * Data warehousing, OLAP, Real-time analytics, Predictive analytics, Reporting
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface DataWarehouseConfig {
    type: WarehouseType;
    connection: ConnectionConfig;
    schema: SchemaDefinition;
    etl: ETLConfig;
    optimization: OptimizationConfig;
}
export type WarehouseType = 'redshift' | 'snowflake' | 'bigquery' | 'synapse';
export interface ConnectionConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    poolSize: number;
}
export interface SchemaDefinition {
    dimensions: Dimension[];
    facts: FactTable[];
    relationships: Relationship[];
}
export interface Dimension {
    name: string;
    table: string;
    key: string;
    attributes: DimensionAttribute[];
    hierarchies: Hierarchy[];
}
export interface DimensionAttribute {
    name: string;
    type: AttributeType;
    nullable: boolean;
}
export type AttributeType = 'string' | 'number' | 'date' | 'boolean';
export interface Hierarchy {
    name: string;
    levels: string[];
}
export interface FactTable {
    name: string;
    table: string;
    measures: Measure[];
    dimensions: string[];
    granularity: Granularity;
}
export interface Measure {
    name: string;
    aggregation: AggregationType;
    format?: string;
}
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count';
export type Granularity = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
export interface Relationship {
    from: string;
    to: string;
    type: RelationType;
    keys: KeyMapping;
}
export type RelationType = 'one_to_one' | 'one_to_many' | 'many_to_many';
export interface KeyMapping {
    fromKey: string;
    toKey: string;
}
export interface ETLConfig {
    schedule: string;
    batchSize: number;
    parallelism: number;
    retryPolicy: RetryPolicy;
}
export interface RetryPolicy {
    maxAttempts: number;
    backoff: BackoffStrategy;
}
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';
export interface OptimizationConfig {
    enablePartitioning: boolean;
    enableIndexing: boolean;
    enableCompression: boolean;
    enableCaching: boolean;
}
export declare class DataWarehouse extends EventEmitter {
    private config;
    private dimensions;
    private facts;
    constructor(config: DataWarehouseConfig);
    private initializeSchema;
    loadDimension(dimensionName: string, data: any[]): Promise<void>;
    loadFacts(factName: string, data: any[]): Promise<void>;
    query(query: AnalyticsQuery): Promise<QueryResult>;
    private executeQuery;
    private generateMockData;
    private extractColumns;
    private sleep;
    getStats(): {
        dimensions: number;
        facts: number;
        dimensionRecords: number;
        factRecords: number;
    };
}
export interface DimensionData {
    definition: Dimension;
    data: Map<any, any>;
}
export interface FactData {
    [key: string]: any;
}
export interface AnalyticsQuery {
    dimensions: string[];
    measures: MeasureQuery[];
    filters?: Filter[];
    groupBy?: string[];
    orderBy?: OrderBy[];
    limit?: number;
}
export interface MeasureQuery {
    name: string;
    aggregation: AggregationType;
    field: string;
}
export interface Filter {
    field: string;
    operator: FilterOperator;
    value: any;
}
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
export interface OrderBy {
    field: string;
    direction: SortDirection;
}
export type SortDirection = 'asc' | 'desc';
export interface QueryResult {
    rows: any[];
    columns: string[];
    metadata: QueryMetadata;
}
export interface QueryMetadata {
    executionTime: number;
    rowCount: number;
    scannedRows: number;
}
export interface CubeConfig {
    name: string;
    dimensions: CubeDimension[];
    measures: CubeMeasure[];
    aggregations: AggregationDefinition[];
}
export interface CubeDimension {
    name: string;
    hierarchy: string[];
    cardinality: number;
}
export interface CubeMeasure {
    name: string;
    type: MeasureType;
    formula?: string;
}
export type MeasureType = 'additive' | 'semi_additive' | 'non_additive';
export interface AggregationDefinition {
    name: string;
    dimensions: string[];
    measures: string[];
    precompute: boolean;
}
export interface CubeSlice {
    dimensions: Map<string, any>;
    measures: Map<string, number>;
}
export interface DrillDownRequest {
    dimension: string;
    level: number;
    filters: Map<string, any>;
}
export declare class OLAPCube extends EventEmitter {
    private config;
    private data;
    private aggregations;
    constructor(config: CubeConfig);
    private initializeAggregations;
    slice(dimensions: Map<string, any>): Promise<CubeSlice[]>;
    dice(dimensionRanges: Map<string, [any, any]>): Promise<CubeSlice[]>;
    drillDown(request: DrillDownRequest): Promise<CubeSlice[]>;
    rollUp(dimension: string, level: number): Promise<Map<string, number>>;
    pivot(rows: string[], columns: string[], values: string[]): Promise<PivotTable>;
    private matchesDimensions;
    private matchesRanges;
    private buildRollUpKey;
    addSlice(slice: CubeSlice): void;
    private generateSliceKey;
    getStats(): {
        slices: number;
        dimensions: number;
        measures: number;
        precomputedAggregations: number;
    };
}
export interface PivotTable {
    rows: string[];
    columns: string[];
    values: Map<string, number>;
}
export interface RealTimeConfig {
    windowSize: number;
    slideInterval: number;
    aggregations: StreamAggregation[];
    alerting: AlertConfig;
}
export interface StreamAggregation {
    name: string;
    type: AggregationType;
    field: string;
    window: WindowType;
}
export type WindowType = 'tumbling' | 'sliding' | 'session';
export interface AlertConfig {
    enabled: boolean;
    rules: AlertRule[];
}
export interface AlertRule {
    id: string;
    condition: AlertCondition;
    threshold: number;
    action: AlertAction;
}
export interface AlertCondition {
    metric: string;
    operator: ComparisonOperator;
}
export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
export interface AlertAction {
    type: ActionType;
    config: Record<string, any>;
}
export type ActionType = 'email' | 'slack' | 'webhook' | 'pagerduty';
export interface StreamEvent {
    id: string;
    timestamp: Date;
    data: Record<string, any>;
}
export interface AggregationResult {
    window: TimeWindow;
    aggregations: Map<string, number>;
}
export interface TimeWindow {
    start: Date;
    end: Date;
    count: number;
}
export declare class RealTimeAnalyticsEngine extends EventEmitter {
    private config;
    private eventBuffer;
    private windows;
    private results;
    constructor(config?: Partial<RealTimeConfig>);
    ingest(event: StreamEvent): void;
    private shouldProcessWindow;
    private processWindow;
    private computeAggregation;
    private checkAlerts;
    private evaluateCondition;
    private triggerAlert;
    private startWindowProcessing;
    getLatestResults(count?: number): AggregationResult[];
    getStats(): {
        bufferedEvents: number;
        windows: number;
        results: number;
        aggregations: number;
    };
}
export interface PredictiveConfig {
    algorithms: PredictiveAlgorithm[];
    trainingInterval: number;
    predictionHorizon: number;
}
export interface PredictiveAlgorithm {
    name: string;
    type: AlgorithmType;
    config: Record<string, any>;
}
export type AlgorithmType = 'linear_regression' | 'arima' | 'prophet' | 'lstm' | 'random_forest';
export interface TimeSeries {
    timestamps: Date[];
    values: number[];
}
export interface Forecast {
    algorithm: string;
    predictions: Prediction[];
    confidence: number;
    metrics: ForecastMetrics;
}
export interface Prediction {
    timestamp: Date;
    value: number;
    lower: number;
    upper: number;
}
export interface ForecastMetrics {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
}
export declare class PredictiveAnalytics extends EventEmitter {
    private config;
    private models;
    private forecasts;
    constructor(config?: Partial<PredictiveConfig>);
    private initializeModels;
    train(algorithmName: string, data: TimeSeries): Promise<void>;
    predict(algorithmName: string, data: TimeSeries): Promise<Forecast>;
    private generatePredictions;
    private calculateMetrics;
    private sleep;
    getStats(): {
        models: number;
        trainedModels: number;
        forecasts: number;
    };
}
export interface PredictiveModel {
    algorithm: PredictiveAlgorithm;
    trained: boolean;
    lastTrained?: Date;
    accuracy: number;
}
export declare class CompleteAnalyticsSystem {
    warehouse: DataWarehouse;
    cube: OLAPCube;
    realtime: RealTimeAnalyticsEngine;
    predictive: PredictiveAnalytics;
    constructor(warehouseConfig: DataWarehouseConfig, cubeConfig: CubeConfig);
    getOverallStats(): {
        warehouse: {
            dimensions: number;
            facts: number;
            dimensionRecords: number;
            factRecords: number;
        };
        cube: {
            slices: number;
            dimensions: number;
            measures: number;
            precomputedAggregations: number;
        };
        realtime: {
            bufferedEvents: number;
            windows: number;
            results: number;
            aggregations: number;
        };
        predictive: {
            models: number;
            trainedModels: number;
            forecasts: number;
        };
    };
}
//# sourceMappingURL=MEGA_AdvancedAnalytics.d.ts.map