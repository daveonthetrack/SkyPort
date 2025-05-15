import { supabase } from '../lib/supabase';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationPoint = {
  id: string;
  title: string;
  location: string;
  coordinates: Coordinates;
  type: 'pickup' | 'delivery';
  itemId: string;
};

type OptimizedRoute = {
  points: LocationPoint[];
  totalDistance: number;
  estimatedTime: number;
};

export class RouteOptimizerService {
  /**
   * Optimizes the route for a traveler to pick up and deliver multiple items
   * Uses a nearest-neighbor approach (greedy algorithm)
   */
  static async optimizeRoute(
    tripId: string,
    startingLocation?: Coordinates
  ): Promise<OptimizedRoute> {
    try {
      // Fetch all items associated with this trip
      const { data: items, error } = await supabase
        .from('items')
        .select('id, title, pickup_location, destination, status')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');

      if (error) throw error;

      if (!items || items.length === 0) {
        return {
          points: [],
          totalDistance: 0,
          estimatedTime: 0,
        };
      }

      // Convert locations to coordinates - in a real app, this would use a geocoding service
      // For this demo, we'll simulate coordinates
      const allPoints: LocationPoint[] = [];
      
      for (const item of items) {
        // Simulate pickup coordinates (would use geocoding API in production)
        const pickupCoords = this.simulateCoordinates(item.pickup_location);
        allPoints.push({
          id: `pickup-${item.id}`,
          title: item.title,
          location: item.pickup_location,
          coordinates: pickupCoords,
          type: 'pickup',
          itemId: item.id,
        });
        
        // Simulate delivery coordinates
        const deliveryCoords = this.simulateCoordinates(item.destination);
        allPoints.push({
          id: `delivery-${item.id}`,
          title: item.title,
          location: item.destination,
          coordinates: deliveryCoords,
          type: 'delivery',
          itemId: item.id,
        });
      }

      // Use nearest neighbor algorithm to optimize route
      const optimizedPoints = this.nearestNeighborAlgorithm(
        allPoints,
        startingLocation
      );

      // Calculate total distance and estimated time
      let totalDistance = 0;
      
      for (let i = 0; i < optimizedPoints.length - 1; i++) {
        const distance = this.calculateDistance(
          optimizedPoints[i].coordinates,
          optimizedPoints[i + 1].coordinates
        );
        totalDistance += distance;
      }

      // Estimate time based on average speed (30 km/h)
      const estimatedTime = totalDistance / 30; // in hours

      return {
        points: optimizedPoints,
        totalDistance,
        estimatedTime,
      };
    } catch (error) {
      console.error('Error optimizing route:', error);
      throw error;
    }
  }

  /**
   * Nearest Neighbor algorithm for route optimization
   * Starts with the closest point to the starting location and then
   * repeatedly visits the nearest unvisited point
   */
  private static nearestNeighborAlgorithm(
    points: LocationPoint[],
    startingLocation?: Coordinates
  ): LocationPoint[] {
    if (points.length === 0) return [];
    if (points.length === 1) return [...points];

    // Create a copy of points to work with
    const remainingPoints = [...points];
    const route: LocationPoint[] = [];

    // Start with a point closest to the starting location if provided
    let currentPoint: LocationPoint;
    
    if (startingLocation) {
      // Find the point closest to the starting location
      let minDistance = Number.MAX_VALUE;
      let closestIndex = 0;
      
      remainingPoints.forEach((point, index) => {
        const distance = this.calculateDistance(startingLocation, point.coordinates);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      currentPoint = remainingPoints[closestIndex];
      remainingPoints.splice(closestIndex, 1);
    } else {
      // If no starting location, just take the first point
      currentPoint = remainingPoints.shift()!;
    }
    
    route.push(currentPoint);

    // Create a constraint - delivery points must come after their pickup points
    const pickedUpItems = new Set<string>();
    if (currentPoint.type === 'pickup') {
      pickedUpItems.add(currentPoint.itemId);
    }

    // Keep finding the nearest neighbor until all points are visited
    while (remainingPoints.length > 0) {
      let nearestIndex = -1;
      let minDistance = Number.MAX_VALUE;
      
      // Find the nearest point that respects constraints
      for (let i = 0; i < remainingPoints.length; i++) {
        const point = remainingPoints[i];
        
        // Skip delivery points for items we haven't picked up yet
        if (point.type === 'delivery' && !pickedUpItems.has(point.itemId)) {
          continue;
        }
        
        const distance = this.calculateDistance(
          currentPoint.coordinates,
          point.coordinates
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      // If we can't find a valid next point (due to constraints), prioritize pickup
      if (nearestIndex === -1) {
        // Find the closest pickup point
        for (let i = 0; i < remainingPoints.length; i++) {
          const point = remainingPoints[i];
          
          if (point.type !== 'pickup') continue;
          
          const distance = this.calculateDistance(
            currentPoint.coordinates,
            point.coordinates
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
          }
        }
      }

      // Add the nearest point to our route
      if (nearestIndex !== -1) {
        currentPoint = remainingPoints[nearestIndex];
        remainingPoints.splice(nearestIndex, 1);
        route.push(currentPoint);
        
        // Update the set of picked up items
        if (currentPoint.type === 'pickup') {
          pickedUpItems.add(currentPoint.itemId);
        }
      } else {
        // This shouldn't happen with valid data, but break to avoid infinite loop
        break;
      }
    }

    return route;
  }

  /**
   * Calculate the distance between two points using the Haversine formula
   */
  private static calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(point2.latitude - point1.latitude);
    const dLon = this.deg2rad(point2.longitude - point1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(point1.latitude)) * Math.cos(this.deg2rad(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    
    return distance;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Simulates coordinates for a location based on a string
   * In a real app, this would be replaced with a geocoding service
   */
  private static simulateCoordinates(location: string): Coordinates {
    // This is a demo function that creates pseudo-random coordinates
    // In production, use a real geocoding service
    
    // Create a simple hash of the location string
    let hash = 0;
    for (let i = 0; i < location.length; i++) {
      hash = ((hash << 5) - hash) + location.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    
    // Use the hash to generate latitude and longitude within common ranges
    // Latitude: -90 to 90, Longitude: -180 to 180
    const latitudeBase = 40.7128; // New York latitude
    const longitudeBase = -74.0060; // New York longitude
    
    // Create small deviations based on hash
    const latOffset = (hash % 1000) / 10000;
    const lonOffset = ((hash >> 10) % 1000) / 10000;
    
    return {
      latitude: latitudeBase + latOffset,
      longitude: longitudeBase + lonOffset,
    };
  }
} 