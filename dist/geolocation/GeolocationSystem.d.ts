/**
 * Geolocation and Mapping System
 * Geocoding, reverse geocoding, distance calculation, routing, and geofencing
 */
export interface GeoPoint {
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
}
export interface GeoAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    formattedAddress: string;
}
export interface GeoLocation {
    id: string;
    point: GeoPoint;
    address?: GeoAddress;
    type: LocationType;
    metadata: Record<string, any>;
    createdAt: Date;
}
export declare enum LocationType {
    Point = "point",
    Store = "store",
    Warehouse = "warehouse",
    User = "user",
    Delivery = "delivery"
}
export interface GeoBounds {
    northeast: GeoPoint;
    southwest: GeoPoint;
}
export interface GeoCircle {
    center: GeoPoint;
    radius: number;
}
export interface GeoPolygon {
    points: GeoPoint[];
}
export interface GeoFence {
    id: string;
    name: string;
    type: GeoFenceType;
    geometry: GeoCircle | GeoPolygon;
    triggers: GeoFenceTrigger[];
    active: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
}
export declare enum GeoFenceType {
    Circle = "circle",
    Polygon = "polygon"
}
export interface GeoFenceTrigger {
    event: GeoFenceEvent;
    action: string;
    enabled: boolean;
}
export declare enum GeoFenceEvent {
    Enter = "enter",
    Exit = "exit",
    Dwell = "dwell"
}
export interface GeoFenceAlert {
    id: string;
    fenceId: string;
    locationId: string;
    event: GeoFenceEvent;
    timestamp: Date;
}
export interface Route {
    id: string;
    origin: GeoPoint;
    destination: GeoPoint;
    waypoints: GeoPoint[];
    legs: RouteLeg[];
    totalDistance: number;
    totalDuration: number;
    optimized: boolean;
    createdAt: Date;
}
export interface RouteLeg {
    startPoint: GeoPoint;
    endPoint: GeoPoint;
    distance: number;
    duration: number;
    steps: RouteStep[];
}
export interface RouteStep {
    instruction: string;
    distance: number;
    duration: number;
    polyline: string;
}
export interface ProximitySearch {
    center: GeoPoint;
    radius: number;
    filter?: LocationFilter;
    sort?: ProximitySort;
    limit?: number;
}
export interface LocationFilter {
    types?: LocationType[];
    metadata?: Record<string, any>;
}
export declare enum ProximitySort {
    Distance = "distance",
    Rating = "rating",
    Popularity = "popularity"
}
export interface ProximityResult {
    location: GeoLocation;
    distance: number;
    bearing: number;
}
export interface HeatmapPoint {
    point: GeoPoint;
    weight: number;
}
export interface HeatmapConfig {
    points: HeatmapPoint[];
    radius: number;
    opacity: number;
    gradient: string[];
}
export interface Cluster {
    id: string;
    center: GeoPoint;
    count: number;
    locations: string[];
}
export interface TravelMatrix {
    origins: GeoPoint[];
    destinations: GeoPoint[];
    distances: number[][];
    durations: number[][];
}
/**
 * Geocoding Manager
 */
export declare class GeocodingManager {
    private cache;
    /**
     * Geocode address to coordinates
     */
    geocode(address: string): Promise<GeoPoint | null>;
    /**
     * Reverse geocode coordinates to address
     */
    reverseGeocode(point: GeoPoint): Promise<GeoAddress | null>;
    /**
     * Batch geocode
     */
    batchGeocode(addresses: string[]): Promise<Map<string, GeoPoint>>;
    /**
     * Autocomplete address
     */
    autocomplete(input: string, location?: GeoPoint): Promise<string[]>;
}
/**
 * Location Manager
 */
export declare class LocationManager {
    private locations;
    /**
     * Add location
     */
    addLocation(location: Omit<GeoLocation, 'id' | 'createdAt'>): GeoLocation;
    /**
     * Update location
     */
    updateLocation(locationId: string, point: GeoPoint): void;
    /**
     * Get location
     */
    getLocation(locationId: string): GeoLocation | undefined;
    /**
     * List locations
     */
    listLocations(filter?: LocationFilter): GeoLocation[];
    /**
     * Delete location
     */
    deleteLocation(locationId: string): void;
    /**
     * Find nearby locations
     */
    findNearby(search: ProximitySearch): ProximityResult[];
    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(point1: GeoPoint, point2: GeoPoint): number;
    /**
     * Calculate bearing between two points
     */
    calculateBearing(point1: GeoPoint, point2: GeoPoint): number;
    /**
     * Check if point is within bounds
     */
    isWithinBounds(point: GeoPoint, bounds: GeoBounds): boolean;
    private toRadians;
    private toDegrees;
    private generateLocationId;
}
/**
 * Geofence Manager
 */
export declare class GeofenceManager {
    private fences;
    private alerts;
    private locationManager;
    constructor(locationManager: LocationManager);
    /**
     * Create geofence
     */
    createFence(fence: Omit<GeoFence, 'id' | 'createdAt'>): GeoFence;
    /**
     * Check if location is inside fence
     */
    checkFence(locationId: string): GeoFenceAlert[];
    /**
     * Check if point is inside fence
     */
    isPointInFence(point: GeoPoint, fence: GeoFence): boolean;
    /**
     * Get fence
     */
    getFence(fenceId: string): GeoFence | undefined;
    /**
     * List fences
     */
    listFences(filter?: {
        active?: boolean;
    }): GeoFence[];
    /**
     * Delete fence
     */
    deleteFence(fenceId: string): void;
    /**
     * Get alerts
     */
    getAlerts(filter?: {
        fenceId?: string;
        locationId?: string;
    }): GeoFenceAlert[];
    private isPointInPolygon;
    private wasLocationInFence;
    private createAlert;
    private generateFenceId;
    private generateAlertId;
}
/**
 * Routing Manager
 */
export declare class RoutingManager {
    private routes;
    private locationManager;
    constructor(locationManager: LocationManager);
    /**
     * Calculate route
     */
    calculateRoute(origin: GeoPoint, destination: GeoPoint, options?: {
        waypoints?: GeoPoint[];
        optimize?: boolean;
    }): Promise<Route>;
    /**
     * Optimize waypoints order
     */
    optimizeWaypoints(origin: GeoPoint, destination: GeoPoint, waypoints: GeoPoint[]): Promise<GeoPoint[]>;
    /**
     * Calculate travel matrix
     */
    calculateMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<TravelMatrix>;
    /**
     * Get route
     */
    getRoute(routeId: string): Route | undefined;
    /**
     * List routes
     */
    listRoutes(): Route[];
    private generateSteps;
    private generateRouteId;
}
/**
 * Clustering Manager
 */
export declare class ClusteringManager {
    private locationManager;
    constructor(locationManager: LocationManager);
    /**
     * Cluster locations
     */
    clusterLocations(locations: GeoLocation[], maxDistance: number): Cluster[];
    /**
     * Calculate centroid of points
     */
    calculateCentroid(points: GeoPoint[]): GeoPoint;
    private generateClusterId;
}
/**
 * Heatmap Manager
 */
export declare class HeatmapManager {
    /**
     * Generate heatmap data
     */
    generateHeatmap(points: HeatmapPoint[], config?: Partial<HeatmapConfig>): HeatmapConfig;
    /**
     * Aggregate points into grid
     */
    aggregateToGrid(points: HeatmapPoint[], gridSize: number): HeatmapPoint[];
}
/**
 * Singleton instances
 */
export declare const geocodingManager: GeocodingManager;
export declare const locationManager: LocationManager;
export declare const geofenceManager: GeofenceManager;
export declare const routingManager: RoutingManager;
export declare const clusteringManager: ClusteringManager;
export declare const heatmapManager: HeatmapManager;
//# sourceMappingURL=GeolocationSystem.d.ts.map