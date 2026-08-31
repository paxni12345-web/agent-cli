/**
 * Geolocation and Mapping System
 * Geocoding, reverse geocoding, distance calculation, routing, and geofencing
 */

import { eventBus } from '../core/EventBus';

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

export enum LocationType {
  Point = 'point',
  Store = 'store',
  Warehouse = 'warehouse',
  User = 'user',
  Delivery = 'delivery',
}

export interface GeoBounds {
  northeast: GeoPoint;
  southwest: GeoPoint;
}

export interface GeoCircle {
  center: GeoPoint;
  radius: number; // meters
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

export enum GeoFenceType {
  Circle = 'circle',
  Polygon = 'polygon',
}

export interface GeoFenceTrigger {
  event: GeoFenceEvent;
  action: string;
  enabled: boolean;
}

export enum GeoFenceEvent {
  Enter = 'enter',
  Exit = 'exit',
  Dwell = 'dwell',
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
  totalDistance: number; // meters
  totalDuration: number; // seconds
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

export enum ProximitySort {
  Distance = 'distance',
  Rating = 'rating',
  Popularity = 'popularity',
}

export interface ProximityResult {
  location: GeoLocation;
  distance: number; // meters
  bearing: number; // degrees
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
export class GeocodingManager {
  private cache: Map<string, GeoAddress> = new Map();

  /**
   * Geocode address to coordinates
   */
  async geocode(address: string): Promise<GeoPoint | null> {
    // Check cache
    const cacheKey = `geocode:${address}`;

    // Mock geocoding
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simple mock result
    const point: GeoPoint = {
      latitude: 37.7749 + Math.random() * 0.1,
      longitude: -122.4194 + Math.random() * 0.1,
      accuracy: 10,
    };

    eventBus.emitSync('geo.geocoded', { address, point }, 'GeocodingManager');

    return point;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(point: GeoPoint): Promise<GeoAddress | null> {
    // Mock reverse geocoding
    await new Promise(resolve => setTimeout(resolve, 50));

    const address: GeoAddress = {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      postalCode: '94102',
      formattedAddress: '123 Main St, San Francisco, CA 94102, USA',
    };

    eventBus.emitSync('geo.reverse_geocoded', { point, address }, 'GeocodingManager');

    return address;
  }

  /**
   * Batch geocode
   */
  async batchGeocode(addresses: string[]): Promise<Map<string, GeoPoint>> {
    const results = new Map<string, GeoPoint>();

    for (const address of addresses) {
      const point = await this.geocode(address);
      if (point) {
        results.set(address, point);
      }
    }

    return results;
  }

  /**
   * Autocomplete address
   */
  async autocomplete(input: string, location?: GeoPoint): Promise<string[]> {
    // Mock autocomplete
    await new Promise(resolve => setTimeout(resolve, 50));

    return [
      `${input} St, San Francisco, CA`,
      `${input} Ave, Oakland, CA`,
      `${input} Blvd, Berkeley, CA`,
    ];
  }
}

/**
 * Location Manager
 */
export class LocationManager {
  private locations: Map<string, GeoLocation> = new Map();

  /**
   * Add location
   */
  addLocation(location: Omit<GeoLocation, 'id' | 'createdAt'>): GeoLocation {
    const fullLocation: GeoLocation = {
      ...location,
      id: this.generateLocationId(),
      createdAt: new Date(),
    };

    this.locations.set(fullLocation.id, fullLocation);

    eventBus.emitSync('geo.location_added', fullLocation, 'LocationManager');

    return fullLocation;
  }

  /**
   * Update location
   */
  updateLocation(locationId: string, point: GeoPoint): void {
    const location = this.locations.get(locationId);

    if (location) {
      location.point = point;
      eventBus.emitSync('geo.location_updated', location, 'LocationManager');
    }
  }

  /**
   * Get location
   */
  getLocation(locationId: string): GeoLocation | undefined {
    return this.locations.get(locationId);
  }

  /**
   * List locations
   */
  listLocations(filter?: LocationFilter): GeoLocation[] {
    let locations = Array.from(this.locations.values());

    if (filter?.types) {
      locations = locations.filter(l => filter.types!.includes(l.type));
    }

    if (filter?.metadata) {
      locations = locations.filter(l => {
        return Object.entries(filter.metadata!).every(
          ([key, value]) => l.metadata[key] === value
        );
      });
    }

    return locations;
  }

  /**
   * Delete location
   */
  deleteLocation(locationId: string): void {
    this.locations.delete(locationId);
    eventBus.emitSync('geo.location_deleted', { locationId }, 'LocationManager');
  }

  /**
   * Find nearby locations
   */
  findNearby(search: ProximitySearch): ProximityResult[] {
    const locations = this.listLocations(search.filter);
    const results: ProximityResult[] = [];

    for (const location of locations) {
      const distance = this.calculateDistance(search.center, location.point);

      if (distance <= search.radius) {
        const bearing = this.calculateBearing(search.center, location.point);

        results.push({
          location,
          distance,
          bearing,
        });
      }
    }

    // Sort results
    if (search.sort === ProximitySort.Distance) {
      results.sort((a, b) => a.distance - b.distance);
    }

    // Apply limit
    if (search.limit) {
      return results.slice(0, search.limit);
    }

    return results;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371000; // Earth radius in meters
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);
    const deltaLat = this.toRadians(point2.latitude - point1.latitude);
    const deltaLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate bearing between two points
   */
  calculateBearing(point1: GeoPoint, point2: GeoPoint): number {
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);
    const deltaLon = this.toRadians(point2.longitude - point1.longitude);

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    const bearing = Math.atan2(y, x);

    return (this.toDegrees(bearing) + 360) % 360;
  }

  /**
   * Check if point is within bounds
   */
  isWithinBounds(point: GeoPoint, bounds: GeoBounds): boolean {
    return (
      point.latitude >= bounds.southwest.latitude &&
      point.latitude <= bounds.northeast.latitude &&
      point.longitude >= bounds.southwest.longitude &&
      point.longitude <= bounds.northeast.longitude
    );
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private generateLocationId(): string {
    return `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Geofence Manager
 */
export class GeofenceManager {
  private fences: Map<string, GeoFence> = new Map();
  private alerts: Map<string, GeoFenceAlert> = new Map();
  private locationManager: LocationManager;

  constructor(locationManager: LocationManager) {
    this.locationManager = locationManager;
  }

  /**
   * Create geofence
   */
  createFence(fence: Omit<GeoFence, 'id' | 'createdAt'>): GeoFence {
    const fullFence: GeoFence = {
      ...fence,
      id: this.generateFenceId(),
      createdAt: new Date(),
    };

    this.fences.set(fullFence.id, fullFence);

    eventBus.emitSync('geo.fence_created', fullFence, 'GeofenceManager');

    return fullFence;
  }

  /**
   * Check if location is inside fence
   */
  checkFence(locationId: string): GeoFenceAlert[] {
    const location = this.locationManager.getLocation(locationId);

    if (!location) {
      return [];
    }

    const alerts: GeoFenceAlert[] = [];

    for (const fence of this.fences.values()) {
      if (!fence.active) continue;

      const wasInside = this.wasLocationInFence(locationId, fence.id);
      const isInside = this.isPointInFence(location.point, fence);

      if (!wasInside && isInside) {
        // Enter event
        const alert = this.createAlert(fence.id, locationId, GeoFenceEvent.Enter);
        alerts.push(alert);
      } else if (wasInside && !isInside) {
        // Exit event
        const alert = this.createAlert(fence.id, locationId, GeoFenceEvent.Exit);
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Check if point is inside fence
   */
  isPointInFence(point: GeoPoint, fence: GeoFence): boolean {
    if (fence.type === GeoFenceType.Circle) {
      const circle = fence.geometry as GeoCircle;
      const distance = this.locationManager.calculateDistance(point, circle.center);
      return distance <= circle.radius;
    } else {
      const polygon = fence.geometry as GeoPolygon;
      return this.isPointInPolygon(point, polygon);
    }
  }

  /**
   * Get fence
   */
  getFence(fenceId: string): GeoFence | undefined {
    return this.fences.get(fenceId);
  }

  /**
   * List fences
   */
  listFences(filter?: { active?: boolean }): GeoFence[] {
    let fences = Array.from(this.fences.values());

    if (filter?.active !== undefined) {
      fences = fences.filter(f => f.active === filter.active);
    }

    return fences;
  }

  /**
   * Delete fence
   */
  deleteFence(fenceId: string): void {
    this.fences.delete(fenceId);
    eventBus.emitSync('geo.fence_deleted', { fenceId }, 'GeofenceManager');
  }

  /**
   * Get alerts
   */
  getAlerts(filter?: { fenceId?: string; locationId?: string }): GeoFenceAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter?.fenceId) {
      alerts = alerts.filter(a => a.fenceId === filter.fenceId);
    }

    if (filter?.locationId) {
      alerts = alerts.filter(a => a.locationId === filter.locationId);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private isPointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
    // Ray casting algorithm
    let inside = false;
    const points = polygon.points;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].longitude;
      const yi = points[i].latitude;
      const xj = points[j].longitude;
      const yj = points[j].latitude;

      const intersect =
        yi > point.latitude !== yj > point.latitude &&
        point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  private wasLocationInFence(locationId: string, fenceId: string): boolean {
    // Check previous alerts to determine if location was inside
    const previousAlert = Array.from(this.alerts.values())
      .filter(a => a.locationId === locationId && a.fenceId === fenceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return previousAlert?.event === GeoFenceEvent.Enter;
  }

  private createAlert(fenceId: string, locationId: string, event: GeoFenceEvent): GeoFenceAlert {
    const alert: GeoFenceAlert = {
      id: this.generateAlertId(),
      fenceId,
      locationId,
      event,
      timestamp: new Date(),
    };

    this.alerts.set(alert.id, alert);

    eventBus.emitSync('geo.fence_alert', alert, 'GeofenceManager');

    return alert;
  }

  private generateFenceId(): string {
    return `fence_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Routing Manager
 */
export class RoutingManager {
  private routes: Map<string, Route> = new Map();
  private locationManager: LocationManager;

  constructor(locationManager: LocationManager) {
    this.locationManager = locationManager;
  }

  /**
   * Calculate route
   */
  async calculateRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    options: {
      waypoints?: GeoPoint[];
      optimize?: boolean;
    } = {}
  ): Promise<Route> {
    const waypoints = options.waypoints || [];
    const allPoints = [origin, ...waypoints, destination];

    // Mock route calculation
    await new Promise(resolve => setTimeout(resolve, 100));

    const legs: RouteLeg[] = [];
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < allPoints.length - 1; i++) {
      const startPoint = allPoints[i];
      const endPoint = allPoints[i + 1];

      const distance = this.locationManager.calculateDistance(startPoint, endPoint);
      const duration = distance / 13.89; // Assume 50 km/h average speed

      const leg: RouteLeg = {
        startPoint,
        endPoint,
        distance,
        duration,
        steps: this.generateSteps(startPoint, endPoint, distance),
      };

      legs.push(leg);
      totalDistance += distance;
      totalDuration += duration;
    }

    const route: Route = {
      id: this.generateRouteId(),
      origin,
      destination,
      waypoints,
      legs,
      totalDistance,
      totalDuration,
      optimized: options.optimize || false,
      createdAt: new Date(),
    };

    this.routes.set(route.id, route);

    eventBus.emitSync('geo.route_calculated', route, 'RoutingManager');

    return route;
  }

  /**
   * Optimize waypoints order
   */
  async optimizeWaypoints(origin: GeoPoint, destination: GeoPoint, waypoints: GeoPoint[]): Promise<GeoPoint[]> {
    // Simple nearest neighbor optimization
    const optimized: GeoPoint[] = [];
    const remaining = [...waypoints];
    let current = origin;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = this.locationManager.calculateDistance(current, remaining[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      current = nearest;
    }

    return optimized;
  }

  /**
   * Calculate travel matrix
   */
  async calculateMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<TravelMatrix> {
    const distances: number[][] = [];
    const durations: number[][] = [];

    for (const origin of origins) {
      const distanceRow: number[] = [];
      const durationRow: number[] = [];

      for (const destination of destinations) {
        const distance = this.locationManager.calculateDistance(origin, destination);
        const duration = distance / 13.89; // 50 km/h average

        distanceRow.push(distance);
        durationRow.push(duration);
      }

      distances.push(distanceRow);
      durations.push(durationRow);
    }

    return {
      origins,
      destinations,
      distances,
      durations,
    };
  }

  /**
   * Get route
   */
  getRoute(routeId: string): Route | undefined {
    return this.routes.get(routeId);
  }

  /**
   * List routes
   */
  listRoutes(): Route[] {
    return Array.from(this.routes.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  private generateSteps(start: GeoPoint, end: GeoPoint, distance: number): RouteStep[] {
    // Generate mock steps
    const numSteps = Math.ceil(distance / 500); // One step per 500m
    const steps: RouteStep[] = [];

    for (let i = 0; i < numSteps; i++) {
      steps.push({
        instruction: i === 0 ? 'Head north' : 'Continue straight',
        distance: distance / numSteps,
        duration: distance / numSteps / 13.89,
        polyline: '',
      });
    }

    return steps;
  }

  private generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Clustering Manager
 */
export class ClusteringManager {
  private locationManager: LocationManager;

  constructor(locationManager: LocationManager) {
    this.locationManager = locationManager;
  }

  /**
   * Cluster locations
   */
  clusterLocations(locations: GeoLocation[], maxDistance: number): Cluster[] {
    const clusters: Cluster[] = [];
    const processed = new Set<string>();

    for (const location of locations) {
      if (processed.has(location.id)) continue;

      const cluster: Cluster = {
        id: this.generateClusterId(),
        center: location.point,
        count: 1,
        locations: [location.id],
      };

      processed.add(location.id);

      // Find nearby locations
      for (const other of locations) {
        if (processed.has(other.id)) continue;

        const distance = this.locationManager.calculateDistance(location.point, other.point);

        if (distance <= maxDistance) {
          cluster.locations.push(other.id);
          cluster.count++;
          processed.add(other.id);

          // Update cluster center (average)
          cluster.center = this.calculateCentroid(
            cluster.locations.map(id => locations.find(l => l.id === id)!.point)
          );
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Calculate centroid of points
   */
  calculateCentroid(points: GeoPoint[]): GeoPoint {
    let totalLat = 0;
    let totalLon = 0;

    for (const point of points) {
      totalLat += point.latitude;
      totalLon += point.longitude;
    }

    return {
      latitude: totalLat / points.length,
      longitude: totalLon / points.length,
    };
  }

  private generateClusterId(): string {
    return `cluster_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Heatmap Manager
 */
export class HeatmapManager {
  /**
   * Generate heatmap data
   */
  generateHeatmap(points: HeatmapPoint[], config: Partial<HeatmapConfig> = {}): HeatmapConfig {
    const fullConfig: HeatmapConfig = {
      points,
      radius: config.radius || 50,
      opacity: config.opacity || 0.6,
      gradient: config.gradient || [
        'rgba(0, 0, 255, 0)',
        'rgba(0, 0, 255, 1)',
        'rgba(0, 255, 0, 1)',
        'rgba(255, 255, 0, 1)',
        'rgba(255, 0, 0, 1)',
      ],
    };

    eventBus.emitSync('geo.heatmap_generated', { pointCount: points.length }, 'HeatmapManager');

    return fullConfig;
  }

  /**
   * Aggregate points into grid
   */
  aggregateToGrid(points: HeatmapPoint[], gridSize: number): HeatmapPoint[] {
    const grid = new Map<string, { point: GeoPoint; totalWeight: number }>();

    for (const point of points) {
      const gridX = Math.floor(point.point.longitude / gridSize);
      const gridY = Math.floor(point.point.latitude / gridSize);
      const key = `${gridX},${gridY}`;

      if (!grid.has(key)) {
        grid.set(key, {
          point: {
            latitude: gridY * gridSize + gridSize / 2,
            longitude: gridX * gridSize + gridSize / 2,
          },
          totalWeight: 0,
        });
      }

      const cell = grid.get(key)!;
      cell.totalWeight += point.weight;
    }

    return Array.from(grid.values()).map(cell => ({
      point: cell.point,
      weight: cell.totalWeight,
    }));
  }
}

/**
 * Singleton instances
 */
export const geocodingManager = new GeocodingManager();
export const locationManager = new LocationManager();
export const geofenceManager = new GeofenceManager(locationManager);
export const routingManager = new RoutingManager(locationManager);
export const clusteringManager = new ClusteringManager(locationManager);
export const heatmapManager = new HeatmapManager();
