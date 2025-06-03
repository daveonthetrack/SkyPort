import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
}

export class LocationService {
  private static instance: LocationService;
  private watchId: Location.LocationSubscription | null = null;

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      return {
        granted: status === 'granted',
        canAskAgain,
        status
      };
    } catch (error) {
      console.error('📍 Error requesting location permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: Location.PermissionStatus.DENIED
      };
    }
  }

  /**
   * Get current location for handover verification
   */
  async getCurrentLocation(): Promise<GPSCoordinates | null> {
    try {
      console.log('📍 Getting current location...');
      
      const permissionStatus = await this.requestPermissions();
      if (!permissionStatus.granted) {
        console.log('❌ Location permission not granted');
        Alert.alert(
          'Location Required',
          'Please enable location services to verify handover location',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coordinates: GPSCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };

      console.log('✅ Location acquired:', coordinates);
      return coordinates;

    } catch (error) {
      console.error('❌ Error getting location:', error);
      Alert.alert('Location Error', 'Failed to get your current location. Please try again.');
      return null;
    }
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  calculateDistance(coord1: GPSCoordinates, coord2: GPSCoordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return Math.round(distance);
  }

  /**
   * Verify handover location (within 50 meters of expected location)
   */
  async verifyHandoverLocation(expectedLocation: GPSCoordinates): Promise<{
    verified: boolean;
    currentLocation: GPSCoordinates | null;
    distance: number;
    accuracy: number | null;
  }> {
    const currentLocation = await this.getCurrentLocation();
    
    if (!currentLocation) {
      return {
        verified: false,
        currentLocation: null,
        distance: -1,
        accuracy: null
      };
    }

    const distance = this.calculateDistance(expectedLocation, currentLocation);
    const verified = distance <= 50; // Within 50 meters
    const accuracy = currentLocation.accuracy || null;

    console.log(`📍 Location verification:`, {
      verified,
      distance: `${distance}m`,
      accuracy: accuracy ? `±${Math.round(accuracy)}m` : 'unknown',
      expected: expectedLocation,
      current: currentLocation
    });

    return {
      verified,
      currentLocation,
      distance,
      accuracy
    };
  }

  /**
   * Start real-time location tracking (for delivery progress)
   */
  async startTracking(onLocationUpdate: (location: GPSCoordinates) => void): Promise<boolean> {
    try {
      const permissionStatus = await this.requestPermissions();
      if (!permissionStatus.granted) {
        return false;
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000, // Update every 15 seconds
          distanceInterval: 10, // Update when moved 10 meters
        },
        (location) => {
          const coordinates: GPSCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          };
          onLocationUpdate(coordinates);
        }
      );

      console.log('📍 Location tracking started');
      return true;

    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
      console.log('📍 Location tracking stopped');
    }
  }

  /**
   * Check if location services are enabled
   */
  async isLocationEnabled(): Promise<boolean> {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled;
    } catch (error) {
      console.error('❌ Error checking location services:', error);
      return false;
    }
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(coordinates: GPSCoordinates): Promise<string | null> {
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      if (geocode.length > 0) {
        const address = geocode[0];
        const addressString = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
          address.country
        ].filter(Boolean).join(', ');
        
        return addressString || null;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting address:', error);
      return null;
    }
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Get GPS accuracy status for UI display
   */
  getAccuracyStatus(accuracy: number | null): {
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    color: string;
    description: string;
  } {
    if (!accuracy) {
      return {
        level: 'unknown',
        color: '#888888',
        description: 'Accuracy unknown'
      };
    }

    if (accuracy <= 5) {
      return {
        level: 'excellent',
        color: '#4CAF50',
        description: 'Excellent GPS accuracy'
      };
    } else if (accuracy <= 15) {
      return {
        level: 'good',
        color: '#8BC34A',
        description: 'Good GPS accuracy'
      };
    } else if (accuracy <= 50) {
      return {
        level: 'fair',
        color: '#FFC107',
        description: 'Fair GPS accuracy'
      };
    } else {
      return {
        level: 'poor',
        color: '#FF5722',
        description: 'Poor GPS accuracy'
      };
    }
  }
}

export const locationService = LocationService.getInstance(); 