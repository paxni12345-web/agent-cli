/**
 * Knowledge Graph - Store and query relationships between entities
 * Supports entity extraction, relation building, and graph queries
 */
export interface Entity {
    id: string;
    type: string;
    name: string;
    properties: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface Relation {
    id: string;
    fromId: string;
    toId: string;
    type: string;
    properties: Record<string, any>;
    createdAt: Date;
}
export interface GraphQuery {
    entityType?: string;
    relationTypes?: string[];
    properties?: Record<string, any>;
    depth?: number;
}
export interface GraphPath {
    entities: Entity[];
    relations: Relation[];
    pathLength: number;
}
/**
 * Knowledge graph for storing structured knowledge
 */
export declare class KnowledgeGraph {
    private entities;
    private relations;
    private entityIndex;
    private relationIndex;
    /**
     * Add or update an entity
     */
    addEntity(type: string, name: string, properties?: Record<string, any>): Entity;
    /**
     * Get entity by ID
     */
    getEntity(id: string): Entity | undefined;
    /**
     * Find entity by type and name
     */
    findEntityByName(type: string, name: string): Entity | undefined;
    /**
     * Find entities by type
     */
    findEntitiesByType(type: string): Entity[];
    /**
     * Add a relation between entities
     */
    addRelation(fromId: string, toId: string, type: string, properties?: Record<string, any>): Relation;
    /**
     * Get relation by ID
     */
    getRelation(id: string): Relation | undefined;
    /**
     * Get all relations from an entity
     */
    getRelationsFrom(entityId: string): Relation[];
    /**
     * Get all relations to an entity
     */
    getRelationsTo(entityId: string): Relation[];
    /**
     * Get neighbors of an entity
     */
    getNeighbors(entityId: string, relationTypes?: string[]): Entity[];
    /**
     * Find shortest path between two entities
     */
    findPath(fromId: string, toId: string, maxDepth?: number): GraphPath | null;
    /**
     * Query graph with filters
     */
    query(query: GraphQuery): Entity[];
    /**
     * Get subgraph around an entity
     */
    getSubgraph(entityId: string, depth?: number): {
        entities: Entity[];
        relations: Relation[];
    };
    /**
     * Delete entity and its relations
     */
    deleteEntity(id: string): void;
    /**
     * Delete relation
     */
    deleteRelation(id: string): void;
    /**
     * Clear entire graph
     */
    clear(): void;
    /**
     * Get statistics
     */
    getStats(): {
        entityCount: number;
        relationCount: number;
        entityTypes: string[];
        relationTypes: string[];
    };
    /**
     * Export graph to JSON
     */
    export(): {
        entities: Entity[];
        relations: Relation[];
    };
    /**
     * Import graph from JSON
     */
    import(data: {
        entities: Entity[];
        relations: Relation[];
    }): void;
}
/**
 * Entity extractor - Extract entities from text
 */
export declare class EntityExtractor {
    /**
     * Extract entities from text (simple pattern matching)
     * In production, would use NLP/NER models
     */
    extract(text: string): Array<{
        type: string;
        name: string;
    }>;
}
//# sourceMappingURL=KnowledgeGraph.d.ts.map