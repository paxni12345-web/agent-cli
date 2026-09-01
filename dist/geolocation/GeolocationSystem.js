"use strict";
/**
 * Geolocation and Mapping System
 * Geocoding, reverse geocoding, distance calculation, routing, and geofencing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.heatmapManager = exports.clusteringManager = exports.routingManager = exports.geofenceManager = exports.locationManager = exports.geocodingManager = exports.HeatmapManager = exports.ClusteringManager = exports.RoutingManager = exports.GeofenceManager = exports.LocationManager = exports.GeocodingManager = exports.ProximitySort = exports.GeoFenceEvent = exports.GeoFenceType = exports.LocationType = void 0;
const EventBus_1 = require("../core/EventBus");
var LocationType;
(function (LocationType) {
    LocationType["Point"] = "point";
    LocationType["Store"] = "store";
    LocationType["Warehouse"] = "warehouse";
    LocationType["User"] = "user";
    LocationType["Delivery"] = "delivery";
})(LocationType || (exports.LocationType = LocationType = {}));
var GeoFenceType;
(function (GeoFenceType) {
    GeoFenceType["Circle"] = "circle";
    GeoFenceType["Polygon"] = "polygon";
})(GeoFenceType || (exports.GeoFenceType = GeoFenceType = {}));
var GeoFenceEvent;
(function (GeoFenceEvent) {
    GeoFenceEvent["Enter"] = "enter";
    GeoFenceEvent["Exit"] = "exit";
    GeoFenceEvent["Dwell"] = "dwell";
})(GeoFenceEvent || (exports.GeoFenceEvent = GeoFenceEvent = {}));
var ProximitySort;
(function (ProximitySort) {
    ProximitySort["Distance"] = "distance";
    ProximitySort["Rating"] = "rating";
    ProximitySort["Popularity"] = "popularity";
})(ProximitySort || (exports.ProximitySort = ProximitySort = {}));
/**
 * Geocoding Manager
 */
class GeocodingManager {
    cache = new Map();
    /**
     * Geocode address to coordinates
     */
    async geocode(address) {
        // Check cache
        const cacheKey = `geocode:${address}`;
        // Mock geocoding
        await new Promise(resolve => setTimeout(resolve, 50));
        // Simple mock result
        const point = {
            latitude: 37.7749 + Math.random() * 0.1,
            longitude: -122.4194 + Math.random() * 0.1,
            accuracy: 10,
        };
        EventBus_1.eventBus.emitSync('geo.geocoded', { address, point }, 'GeocodingManager');
        return point;
    }
    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(point) {
        // Mock reverse geocoding
        await new Promise(resolve => setTimeout(resolve, 50));
        const address = {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            country: 'USA',
            postalCode: '94102',
            formattedAddress: '123 Main St, San Francisco, CA 94102, USA',
        };
        EventBus_1.eventBus.emitSync('geo.reverse_geocoded', { point, address }, 'GeocodingManager');
        return address;
    }
    /**
     * Batch geocode
     */
    async batchGeocode(addresses) {
        const results = new Map();
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
    async autocomplete(input, location) {
        // Mock autocomplete
        await new Promise(resolve => setTimeout(resolve, 50));
        return [
            `${input} St, San Francisco, CA`,
            `${input} Ave, Oakland, CA`,
            `${input} Blvd, Berkeley, CA`,
        ];
    }
}
exports.GeocodingManager = GeocodingManager;
/**
 * Location Manager
 */
class LocationManager {
    locations = new Map();
    /**
     * Add location
     */
    addLocation(location) {
        const fullLocation = {
            ...location,
            id: this.generateLocationId(),
            createdAt: new Date(),
        };
        this.locations.set(fullLocation.id, fullLocation);
        EventBus_1.eventBus.emitSync('geo.location_added', fullLocation, 'LocationManager');
        return fullLocation;
    }
    /**
     * Update location
     */
    updateLocation(locationId, point) {
        const location = this.locations.get(locationId);
        if (location) {
            location.point = point;
            EventBus_1.eventBus.emitSync('geo.location_updated', location, 'LocationManager');
        }
    }
    /**
     * Get location
     */
    getLocation(locationId) {
        return this.locations.get(locationId);
    }
    /**
     * List locations
     */
    listLocations(filter) {
        let locations = Array.from(this.locations.values());
        if (filter?.types) {
            locations = locations.filter(l => filter.types.includes(l.type));
        }
        if (filter?.metadata) {
            locations = locations.filter(l => {
                return Object.entries(filter.metadata).every(([key, value]) => l.metadata[key] === value);
            });
        }
        return locations;
    }
    /**
     * Delete location
     */
    deleteLocation(locationId) {
        this.locations.delete(locationId);
        EventBus_1.eventBus.emitSync('geo.location_deleted', { locationId }, 'LocationManager');
    }
    /**
     * Find nearby locations
     */
    findNearby(search) {
        const locations = this.listLocations(search.filter);
        const results = [];
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
    calculateDistance(point1, point2) {
        const R = 6371000; // Earth radius in meters
        const lat1 = this.toRadians(point1.latitude);
        const lat2 = this.toRadians(point2.latitude);
        const deltaLat = this.toRadians(point2.latitude - point1.latitude);
        const deltaLon = this.toRadians(point2.longitude - point1.longitude);
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Calculate bearing between two points
     */
    calculateBearing(point1, point2) {
        const lat1 = this.toRadians(point1.latitude);
        const lat2 = this.toRadians(point2.latitude);
        const deltaLon = this.toRadians(point2.longitude - point1.longitude);
        const y = Math.sin(deltaLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        const bearing = Math.atan2(y, x);
        return (this.toDegrees(bearing) + 360) % 360;
    }
    /**
     * Check if point is within bounds
     */
    isWithinBounds(point, bounds) {
        return (point.latitude >= bounds.southwest.latitude &&
            point.latitude <= bounds.northeast.latitude &&
            point.longitude >= bounds.southwest.longitude &&
            point.longitude <= bounds.northeast.longitude);
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    toDegrees(radians) {
        return radians * (180 / Math.PI);
    }
    generateLocationId() {
        return `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.LocationManager = LocationManager;
/**
 * Geofence Manager
 */
class GeofenceManager {
    fences = new Map();
    alerts = new Map();
    locationManager;
    constructor(locationManager) {
        this.locationManager = locationManager;
    }
    /**
     * Create geofence
     */
    createFence(fence) {
        const fullFence = {
            ...fence,
            id: this.generateFenceId(),
            createdAt: new Date(),
        };
        this.fences.set(fullFence.id, fullFence);
        EventBus_1.eventBus.emitSync('geo.fence_created', fullFence, 'GeofenceManager');
        return fullFence;
    }
    /**
     * Check if location is inside fence
     */
    checkFence(locationId) {
        const location = this.locationManager.getLocation(locationId);
        if (!location) {
            return [];
        }
        const alerts = [];
        for (const fence of this.fences.values()) {
            if (!fence.active)
                continue;
            const wasInside = this.wasLocationInFence(locationId, fence.id);
            const isInside = this.isPointInFence(location.point, fence);
            if (!wasInside && isInside) {
                // Enter event
                const alert = this.createAlert(fence.id, locationId, GeoFenceEvent.Enter);
                alerts.push(alert);
            }
            else if (wasInside && !isInside) {
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
    isPointInFence(point, fence) {
        if (fence.type === GeoFenceType.Circle) {
            const circle = fence.geometry;
            const distance = this.locationManager.calculateDistance(point, circle.center);
            return distance <= circle.radius;
        }
        else {
            const polygon = fence.geometry;
            return this.isPointInPolygon(point, polygon);
        }
    }
    /**
     * Get fence
     */
    getFence(fenceId) {
        return this.fences.get(fenceId);
    }
    /**
     * List fences
     */
    listFences(filter) {
        let fences = Array.from(this.fences.values());
        if (filter?.active !== undefined) {
            fences = fences.filter(f => f.active === filter.active);
        }
        return fences;
    }
    /**
     * Delete fence
     */
    deleteFence(fenceId) {
        this.fences.delete(fenceId);
        EventBus_1.eventBus.emitSync('geo.fence_deleted', { fenceId }, 'GeofenceManager');
    }
    /**
     * Get alerts
     */
    getAlerts(filter) {
        let alerts = Array.from(this.alerts.values());
        if (filter?.fenceId) {
            alerts = alerts.filter(a => a.fenceId === filter.fenceId);
        }
        if (filter?.locationId) {
            alerts = alerts.filter(a => a.locationId === filter.locationId);
        }
        return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    isPointInPolygon(point, polygon) {
        // Ray casting algorithm
        let inside = false;
        const points = polygon.points;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].longitude;
            const yi = points[i].latitude;
            const xj = points[j].longitude;
            const yj = points[j].latitude;
            const intersect = yi > point.latitude !== yj > point.latitude &&
                point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
            if (intersect)
                inside = !inside;
        }
        return inside;
    }
    wasLocationInFence(locationId, fenceId) {
        // Check previous alerts to determine if location was inside
        const previousAlert = Array.from(this.alerts.values())
            .filter(a => a.locationId === locationId && a.fenceId === fenceId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        return previousAlert?.event === GeoFenceEvent.Enter;
    }
    createAlert(fenceId, locationId, event) {
        const alert = {
            id: this.generateAlertId(),
            fenceId,
            locationId,
            event,
            timestamp: new Date(),
        };
        this.alerts.set(alert.id, alert);
        EventBus_1.eventBus.emitSync('geo.fence_alert', alert, 'GeofenceManager');
        return alert;
    }
    generateFenceId() {
        return `fence_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.GeofenceManager = GeofenceManager;
/**
 * Routing Manager
 */
class RoutingManager {
    routes = new Map();
    locationManager;
    constructor(locationManager) {
        this.locationManager = locationManager;
    }
    /**
     * Calculate route
     */
    async calculateRoute(origin, destination, options = {}) {
        const waypoints = options.waypoints || [];
        const allPoints = [origin, ...waypoints, destination];
        // Mock route calculation
        await new Promise(resolve => setTimeout(resolve, 100));
        const legs = [];
        let totalDistance = 0;
        let totalDuration = 0;
        for (let i = 0; i < allPoints.length - 1; i++) {
            const startPoint = allPoints[i];
            const endPoint = allPoints[i + 1];
            const distance = this.locationManager.calculateDistance(startPoint, endPoint);
            const duration = distance / 13.89; // Assume 50 km/h average speed
            const leg = {
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
        const route = {
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
        EventBus_1.eventBus.emitSync('geo.route_calculated', route, 'RoutingManager');
        return route;
    }
    /**
     * Optimize waypoints order
     */
    async optimizeWaypoints(origin, destination, waypoints) {
        // Simple nearest neighbor optimization
        const optimized = [];
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
    async calculateMatrix(origins, destinations) {
        const distances = [];
        const durations = [];
        for (const origin of origins) {
            const distanceRow = [];
            const durationRow = [];
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
    getRoute(routeId) {
        return this.routes.get(routeId);
    }
    /**
     * List routes
     */
    listRoutes() {
        return Array.from(this.routes.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    generateSteps(start, end, distance) {
        // Generate mock steps
        const numSteps = Math.ceil(distance / 500); // One step per 500m
        const steps = [];
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
    generateRouteId() {
        return `route_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RoutingManager = RoutingManager;
/**
 * Clustering Manager
 */
class ClusteringManager {
    locationManager;
    constructor(locationManager) {
        this.locationManager = locationManager;
    }
    /**
     * Cluster locations
     */
    clusterLocations(locations, maxDistance) {
        const clusters = [];
        const processed = new Set();
        for (const location of locations) {
            if (processed.has(location.id))
                continue;
            const cluster = {
                id: this.generateClusterId(),
                center: location.point,
                count: 1,
                locations: [location.id],
            };
            processed.add(location.id);
            // Find nearby locations
            for (const other of locations) {
                if (processed.has(other.id))
                    continue;
                const distance = this.locationManager.calculateDistance(location.point, other.point);
                if (distance <= maxDistance) {
                    cluster.locations.push(other.id);
                    cluster.count++;
                    processed.add(other.id);
                    // Update cluster center (average)
                    cluster.center = this.calculateCentroid(cluster.locations.map(id => locations.find(l => l.id === id).point));
                }
            }
            clusters.push(cluster);
        }
        return clusters;
    }
    /**
     * Calculate centroid of points
     */
    calculateCentroid(points) {
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
    generateClusterId() {
        return `cluster_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.ClusteringManager = ClusteringManager;
/**
 * Heatmap Manager
 */
class HeatmapManager {
    /**
     * Generate heatmap data
     */
    generateHeatmap(points, config = {}) {
        const fullConfig = {
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
        EventBus_1.eventBus.emitSync('geo.heatmap_generated', { pointCount: points.length }, 'HeatmapManager');
        return fullConfig;
    }
    /**
     * Aggregate points into grid
     */
    aggregateToGrid(points, gridSize) {
        const grid = new Map();
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
            const cell = grid.get(key);
            cell.totalWeight += point.weight;
        }
        return Array.from(grid.values()).map(cell => ({
            point: cell.point,
            weight: cell.totalWeight,
        }));
    }
}
exports.HeatmapManager = HeatmapManager;
/**
 * Singleton instances
 */
exports.geocodingManager = new GeocodingManager();
exports.locationManager = new LocationManager();
exports.geofenceManager = new GeofenceManager(exports.locationManager);
exports.routingManager = new RoutingManager(exports.locationManager);
exports.clusteringManager = new ClusteringManager(exports.locationManager);
exports.heatmapManager = new HeatmapManager();
