"use strict";
/**
 * Knowledge Graph - Store and query relationships between entities
 * Supports entity extraction, relation building, and graph queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityExtractor = exports.KnowledgeGraph = void 0;
/**
 * Knowledge graph for storing structured knowledge
 */
class KnowledgeGraph {
    entities = new Map();
    relations = new Map();
    entityIndex = new Map(); // type -> entity IDs
    relationIndex = new Map(); // fromId -> relation IDs
    /**
     * Add or update an entity
     */
    addEntity(type, name, properties = {}) {
        // Check if entity already exists
        const existing = this.findEntityByName(type, name);
        if (existing) {
            existing.properties = { ...existing.properties, ...properties };
            existing.updatedAt = new Date();
            return existing;
        }
        const entity = {
            id: `ent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            name,
            properties,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.entities.set(entity.id, entity);
        // Update index
        if (!this.entityIndex.has(type)) {
            this.entityIndex.set(type, new Set());
        }
        this.entityIndex.get(type).add(entity.id);
        return entity;
    }
    /**
     * Get entity by ID
     */
    getEntity(id) {
        return this.entities.get(id);
    }
    /**
     * Find entity by type and name
     */
    findEntityByName(type, name) {
        const ids = this.entityIndex.get(type);
        if (!ids)
            return undefined;
        for (const id of ids) {
            const entity = this.entities.get(id);
            if (entity && entity.name === name) {
                return entity;
            }
        }
        return undefined;
    }
    /**
     * Find entities by type
     */
    findEntitiesByType(type) {
        const ids = this.entityIndex.get(type);
        if (!ids)
            return [];
        return Array.from(ids)
            .map((id) => this.entities.get(id))
            .filter((e) => e !== undefined);
    }
    /**
     * Add a relation between entities
     */
    addRelation(fromId, toId, type, properties = {}) {
        // Verify entities exist
        if (!this.entities.has(fromId)) {
            throw new Error(`Entity ${fromId} not found`);
        }
        if (!this.entities.has(toId)) {
            throw new Error(`Entity ${toId} not found`);
        }
        const relation = {
            id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fromId,
            toId,
            type,
            properties,
            createdAt: new Date(),
        };
        this.relations.set(relation.id, relation);
        // Update index
        if (!this.relationIndex.has(fromId)) {
            this.relationIndex.set(fromId, new Set());
        }
        this.relationIndex.get(fromId).add(relation.id);
        return relation;
    }
    /**
     * Get relation by ID
     */
    getRelation(id) {
        return this.relations.get(id);
    }
    /**
     * Get all relations from an entity
     */
    getRelationsFrom(entityId) {
        const ids = this.relationIndex.get(entityId);
        if (!ids)
            return [];
        return Array.from(ids)
            .map((id) => this.relations.get(id))
            .filter((r) => r !== undefined);
    }
    /**
     * Get all relations to an entity
     */
    getRelationsTo(entityId) {
        return Array.from(this.relations.values()).filter((r) => r.toId === entityId);
    }
    /**
     * Get neighbors of an entity
     */
    getNeighbors(entityId, relationTypes) {
        const relations = this.getRelationsFrom(entityId);
        const neighbors = [];
        for (const relation of relations) {
            if (relationTypes && !relationTypes.includes(relation.type)) {
                continue;
            }
            const neighbor = this.entities.get(relation.toId);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }
        return neighbors;
    }
    /**
     * Find shortest path between two entities
     */
    findPath(fromId, toId, maxDepth = 5) {
        if (fromId === toId) {
            const entity = this.entities.get(fromId);
            return entity
                ? { entities: [entity], relations: [], pathLength: 0 }
                : null;
        }
        const queue = [{ entityId: fromId, path: [fromId], relations: [] }];
        const visited = new Set([fromId]);
        while (queue.length > 0) {
            const current = queue.shift();
            if (current.path.length > maxDepth) {
                continue;
            }
            const relations = this.getRelationsFrom(current.entityId);
            for (const relation of relations) {
                if (visited.has(relation.toId)) {
                    continue;
                }
                const newPath = [...current.path, relation.toId];
                const newRelations = [...current.relations, relation.id];
                if (relation.toId === toId) {
                    // Found path!
                    return {
                        entities: newPath
                            .map((id) => this.entities.get(id))
                            .filter((e) => e !== undefined),
                        relations: newRelations
                            .map((id) => this.relations.get(id))
                            .filter((r) => r !== undefined),
                        pathLength: newPath.length - 1,
                    };
                }
                visited.add(relation.toId);
                queue.push({
                    entityId: relation.toId,
                    path: newPath,
                    relations: newRelations,
                });
            }
        }
        return null;
    }
    /**
     * Query graph with filters
     */
    query(query) {
        let results = Array.from(this.entities.values());
        // Filter by type
        if (query.entityType) {
            results = results.filter((e) => e.type === query.entityType);
        }
        // Filter by properties
        if (query.properties) {
            results = results.filter((e) => {
                for (const [key, value] of Object.entries(query.properties)) {
                    if (e.properties[key] !== value) {
                        return false;
                    }
                }
                return true;
            });
        }
        return results;
    }
    /**
     * Get subgraph around an entity
     */
    getSubgraph(entityId, depth = 2) {
        const entities = new Map();
        const relations = new Map();
        const toExplore = [
            { id: entityId, currentDepth: 0 },
        ];
        const visited = new Set();
        while (toExplore.length > 0) {
            const { id, currentDepth } = toExplore.shift();
            if (visited.has(id) || currentDepth > depth) {
                continue;
            }
            visited.add(id);
            const entity = this.entities.get(id);
            if (entity) {
                entities.set(id, entity);
            }
            if (currentDepth < depth) {
                const outgoingRelations = this.getRelationsFrom(id);
                for (const relation of outgoingRelations) {
                    relations.set(relation.id, relation);
                    toExplore.push({
                        id: relation.toId,
                        currentDepth: currentDepth + 1,
                    });
                }
            }
        }
        return {
            entities: Array.from(entities.values()),
            relations: Array.from(relations.values()),
        };
    }
    /**
     * Delete entity and its relations
     */
    deleteEntity(id) {
        const entity = this.entities.get(id);
        if (!entity)
            return;
        // Remove from entity index
        const typeSet = this.entityIndex.get(entity.type);
        if (typeSet) {
            typeSet.delete(id);
        }
        // Remove all relations
        const outgoing = this.getRelationsFrom(id);
        const incoming = this.getRelationsTo(id);
        for (const relation of [...outgoing, ...incoming]) {
            this.deleteRelation(relation.id);
        }
        // Remove entity
        this.entities.delete(id);
    }
    /**
     * Delete relation
     */
    deleteRelation(id) {
        const relation = this.relations.get(id);
        if (!relation)
            return;
        // Remove from index
        const fromSet = this.relationIndex.get(relation.fromId);
        if (fromSet) {
            fromSet.delete(id);
        }
        // Remove relation
        this.relations.delete(id);
    }
    /**
     * Clear entire graph
     */
    clear() {
        this.entities.clear();
        this.relations.clear();
        this.entityIndex.clear();
        this.relationIndex.clear();
    }
    /**
     * Get statistics
     */
    getStats() {
        const relationTypes = new Set();
        for (const relation of this.relations.values()) {
            relationTypes.add(relation.type);
        }
        return {
            entityCount: this.entities.size,
            relationCount: this.relations.size,
            entityTypes: Array.from(this.entityIndex.keys()),
            relationTypes: Array.from(relationTypes),
        };
    }
    /**
     * Export graph to JSON
     */
    export() {
        return {
            entities: Array.from(this.entities.values()),
            relations: Array.from(this.relations.values()),
        };
    }
    /**
     * Import graph from JSON
     */
    import(data) {
        this.clear();
        // Import entities
        for (const entity of data.entities) {
            this.entities.set(entity.id, entity);
            if (!this.entityIndex.has(entity.type)) {
                this.entityIndex.set(entity.type, new Set());
            }
            this.entityIndex.get(entity.type).add(entity.id);
        }
        // Import relations
        for (const relation of data.relations) {
            this.relations.set(relation.id, relation);
            if (!this.relationIndex.has(relation.fromId)) {
                this.relationIndex.set(relation.fromId, new Set());
            }
            this.relationIndex.get(relation.fromId).add(relation.id);
        }
    }
}
exports.KnowledgeGraph = KnowledgeGraph;
/**
 * Entity extractor - Extract entities from text
 */
class EntityExtractor {
    /**
     * Extract entities from text (simple pattern matching)
     * In production, would use NLP/NER models
     */
    extract(text) {
        const entities = [];
        // File paths
        const fileMatches = text.matchAll(/([a-zA-Z0-9_-]+\.(ts|js|py|java|go|rs|rb|php|cpp|c|h))/g);
        for (const match of fileMatches) {
            entities.push({ type: 'file', name: match[1] });
        }
        // Functions
        const functionMatches = text.matchAll(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        for (const match of functionMatches) {
            entities.push({ type: 'function', name: match[1] });
        }
        // Classes
        const classMatches = text.matchAll(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        for (const match of classMatches) {
            entities.push({ type: 'class', name: match[1] });
        }
        // Variables (const/let/var)
        const varMatches = text.matchAll(/(const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        for (const match of varMatches) {
            entities.push({ type: 'variable', name: match[2] });
        }
        return entities;
    }
}
exports.EntityExtractor = EntityExtractor;
