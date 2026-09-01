/**
 * Advanced Knowledge Graph System
 * Neo4j integration, Entity/Relation extraction, Graph algorithms
 * Cypher/SPARQL queries, Graph Neural Networks
 */
import { EventEmitter } from 'events';
export interface GraphNode {
    id: string;
    labels: string[];
    properties: Record<string, any>;
    embedding?: number[];
}
export interface GraphEdge {
    id: string;
    type: string;
    source: string;
    target: string;
    properties: Record<string, any>;
    weight: number;
    directed: boolean;
}
export interface Entity {
    id: string;
    text: string;
    type: string;
    startOffset: number;
    endOffset: number;
    confidence: number;
    attributes: Record<string, any>;
}
export interface Relation {
    id: string;
    type: string;
    subject: string;
    object: string;
    confidence: number;
    context?: string;
}
export interface GraphQuery {
    type: 'cypher' | 'sparql' | 'gremlin' | 'native';
    query: string;
    parameters?: Record<string, any>;
}
export interface GraphPath {
    nodes: string[];
    edges: string[];
    length: number;
    weight: number;
}
export interface Community {
    id: string;
    nodes: string[];
    modularity: number;
    density: number;
}
export interface Ontology {
    id: string;
    name: string;
    classes: OntologyClass[];
    properties: OntologyProperty[];
    axioms: Axiom[];
}
export interface OntologyClass {
    id: string;
    name: string;
    parent?: string;
    properties: string[];
}
export interface OntologyProperty {
    id: string;
    name: string;
    domain: string;
    range: string;
    type: 'object' | 'data';
}
export interface Axiom {
    type: 'subclass' | 'disjoint' | 'equivalent' | 'domain' | 'range';
    subject: string;
    predicate: string;
    object: string;
}
export interface GraphMetrics {
    nodeCount: number;
    edgeCount: number;
    density: number;
    averageDegree: number;
    diameter?: number;
    clusteringCoefficient: number;
}
export interface CentralityScores {
    degree: Map<string, number>;
    betweenness: Map<string, number>;
    closeness: Map<string, number>;
    pagerank: Map<string, number>;
    eigenvector: Map<string, number>;
}
export declare class KnowledgeGraphManager extends EventEmitter {
    private nodes;
    private edges;
    private adjacencyList;
    private reverseAdjacencyList;
    private ontologies;
    private config;
    private neo4jConnected;
    constructor(config?: Partial<GraphConfig>);
    addNode(node: GraphNode): Promise<void>;
    addEdge(edge: GraphEdge): Promise<void>;
    removeNode(nodeId: string): Promise<void>;
    removeEdge(edgeId: string): Promise<void>;
    private removeEdgeBetween;
    extractEntities(text: string): Promise<Entity[]>;
    private performNER;
    extractRelations(text: string, entities: Entity[]): Promise<Relation[]>;
    private performRelationExtraction;
    private inferRelationType;
    buildGraphFromText(text: string): Promise<void>;
    query(query: GraphQuery): Promise<any[]>;
    private executeCypherQuery;
    private executeMatchQuery;
    private executeSparqlQuery;
    private executeGremlinQuery;
    private executeNativeQuery;
    findShortestPath(sourceId: string, targetId: string): Promise<GraphPath | null>;
    private dijkstra;
    findAllPaths(sourceId: string, targetId: string, maxDepth?: number): Promise<GraphPath[]>;
    private dfsAllPaths;
    private findEdge;
    detectCommunities(algorithm?: 'louvain' | 'label_propagation' | 'girvan_newman'): Promise<Community[]>;
    private louvainCommunityDetection;
    private labelPropagation;
    private girvanNewman;
    private calculateModularity;
    private calculateCommunityDensity;
    computeCentrality(): Promise<CentralityScores>;
    private computeDegreeCentrality;
    private computeBetweennessCentrality;
    private computeClosenessCentrality;
    private computePageRank;
    private computeEigenvectorCentrality;
    getMetrics(): Promise<GraphMetrics>;
    private computeDiameter;
    private computeClusteringCoefficient;
    loadOntology(ontology: Ontology): Promise<void>;
    inferFromOntology(ontologyId: string): Promise<void>;
    private applyAxiom;
    private inferSubclass;
    private inferDisjoint;
    private inferEquivalent;
    exportForVisualization(): Promise<GraphVisualization>;
    private generateId;
    getNode(id: string): GraphNode | undefined;
    getEdge(id: string): GraphEdge | undefined;
    getNeighbors(nodeId: string): string[];
    getNodeCount(): number;
    getEdgeCount(): number;
}
interface GraphConfig {
    enableNeo4j: boolean;
    neo4jUri: string;
    enableEmbeddings: boolean;
    embeddingDimension: number;
    enableInference: boolean;
    enableGNN: boolean;
}
interface GraphVisualization {
    nodes: Array<{
        id: string;
        label: string;
        group: string;
    }>;
    links: Array<{
        source: string;
        target: string;
        label: string;
        weight: number;
    }>;
}
export default KnowledgeGraphManager;
//# sourceMappingURL=KnowledgeGraphManager.d.ts.map