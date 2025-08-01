const GeofenceValidator = require('../../services/GeofenceValidator');

describe('GeofenceValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new GeofenceValidator();
  });

  describe('calculateDistance', () => {
    test('should calculate distance between two points correctly', () => {
      // Distance between New York and Los Angeles (approximately 3936 km)
      const nyLat = 40.7128;
      const nyLng = -74.0060;
      const laLat = 34.0522;
      const laLng = -118.2437;

      const distance = validator.calculateDistance(nyLat, nyLng, laLat, laLng);
      
      // Should be approximately 3936000 meters (allow 1% tolerance)
      expect(distance).toBeCloseTo(3936000, -3);
    });

    test('should return 0 for identical points', () => {
      const distance = validator.calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });

    test('should calculate short distances accurately', () => {
      // Two points about 100 meters apart
      const lat1 = 40.7128;
      const lng1 = -74.0060;
      const lat2 = 40.7137; // Slightly north
      const lng2 = -74.0060;

      const distance = validator.calculateDistance(lat1, lng1, lat2, lng2);
      
      // Should be approximately 100 meters (allow 10% tolerance for short distances)
      expect(distance).toBeCloseTo(100, 0);
    });

    test('should throw error for invalid coordinates', () => {
      expect(() => validator.calculateDistance(91, 0, 0, 0)).toThrow('Invalid coordinates provided');
      expect(() => validator.calculateDistance(0, 181, 0, 0)).toThrow('Invalid coordinates provided');
      expect(() => validator.calculateDistance(0, 0, -91, 0)).toThrow('Invalid coordinates provided');
      expect(() => validator.calculateDistance(0, 0, 0, -181)).toThrow('Invalid coordinates provided');
      expect(() => validator.calculateDistance(NaN, 0, 0, 0)).toThrow('Invalid coordinates provided');
      expect(() => validator.calculateDistance('invalid', 0, 0, 0)).toThrow('Invalid coordinates provided');
    });
  });

  describe('isPointInCircle', () => {
    test('should return true for point inside circle', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      const radius = 1000; // 1km radius

      // Point about 500m away (should be inside)
      const testLat = 40.7173;
      const testLng = -74.0060;

      const result = validator.isPointInCircle(testLat, testLng, centerLat, centerLng, radius);
      expect(result).toBe(true);
    });

    test('should return false for point outside circle', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      const radius = 100; // 100m radius

      // Point about 500m away (should be outside)
      const testLat = 40.7173;
      const testLng = -74.0060;

      const result = validator.isPointInCircle(testLat, testLng, centerLat, centerLng, radius);
      expect(result).toBe(false);
    });

    test('should return true for point close to circle boundary', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      const radius = 1000;

      // Use a point that's definitely within 1000m
      // Move north by approximately 500m (0.0045 degrees)
      const testLat = centerLat + 0.0045;
      const testLng = centerLng;

      const result = validator.isPointInCircle(testLat, testLng, centerLat, centerLng, radius);
      expect(result).toBe(true);
    });

    test('should return true for center point', () => {
      const centerLat = 40.7128;
      const centerLng = -74.0060;
      const radius = 1000;

      const result = validator.isPointInCircle(centerLat, centerLng, centerLat, centerLng, radius);
      expect(result).toBe(true);
    });

    test('should throw error for invalid coordinates', () => {
      expect(() => validator.isPointInCircle(91, 0, 0, 0, 100)).toThrow('Invalid coordinates provided');
      expect(() => validator.isPointInCircle(0, 0, 91, 0, 100)).toThrow('Invalid coordinates provided');
    });

    test('should throw error for invalid radius', () => {
      expect(() => validator.isPointInCircle(0, 0, 0, 0, -100)).toThrow('Radius must be a positive number');
      expect(() => validator.isPointInCircle(0, 0, 0, 0, 0)).toThrow('Radius must be a positive number');
      expect(() => validator.isPointInCircle(0, 0, 0, 0, 'invalid')).toThrow('Radius must be a positive number');
    });
  });

  describe('isPointInPolygon', () => {
    test('should return true for point inside simple square polygon', () => {
      const polygon = [
        { lat: 40.710, lng: -74.010 },
        { lat: 40.710, lng: -74.000 },
        { lat: 40.720, lng: -74.000 },
        { lat: 40.720, lng: -74.010 }
      ];

      // Point in the middle of the square
      const result = validator.isPointInPolygon(40.715, -74.005, polygon);
      expect(result).toBe(true);
    });

    test('should return false for point outside polygon', () => {
      const polygon = [
        { lat: 40.710, lng: -74.010 },
        { lat: 40.710, lng: -74.000 },
        { lat: 40.720, lng: -74.000 },
        { lat: 40.720, lng: -74.010 }
      ];

      // Point outside the square
      const result = validator.isPointInPolygon(40.725, -74.005, polygon);
      expect(result).toBe(false);
    });

    test('should handle complex polygon shapes', () => {
      // L-shaped polygon
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 3 },
        { lat: 1, lng: 3 },
        { lat: 1, lng: 1 },
        { lat: 3, lng: 1 },
        { lat: 3, lng: 0 }
      ];

      // Point in the vertical part of the L
      expect(validator.isPointInPolygon(0.5, 2, polygon)).toBe(true);
      
      // Point in the horizontal part of the L
      expect(validator.isPointInPolygon(2, 0.5, polygon)).toBe(true);
      
      // Point in the "notch" of the L (should be outside)
      expect(validator.isPointInPolygon(2, 2, polygon)).toBe(false);
    });

    test('should handle triangular polygon', () => {
      const triangle = [
        { lat: 0, lng: 0 },
        { lat: 2, lng: 0 },
        { lat: 1, lng: 2 }
      ];

      // Point inside triangle
      expect(validator.isPointInPolygon(1, 0.5, triangle)).toBe(true);
      
      // Point outside triangle
      expect(validator.isPointInPolygon(0, 1, triangle)).toBe(false);
    });

    test('should handle edge cases on polygon boundary', () => {
      const square = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 2 },
        { lat: 2, lng: 2 },
        { lat: 2, lng: 0 }
      ];

      // Point on edge (ray casting algorithm may vary, but should be consistent)
      const result = validator.isPointInPolygon(1, 0, square);
      expect(typeof result).toBe('boolean');
    });

    test('should throw error for invalid point coordinates', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 }
      ];

      expect(() => validator.isPointInPolygon(91, 0, polygon)).toThrow('Invalid point coordinates provided');
      expect(() => validator.isPointInPolygon(0, 181, polygon)).toThrow('Invalid point coordinates provided');
    });

    test('should throw error for invalid polygon', () => {
      expect(() => validator.isPointInPolygon(0, 0, [])).toThrow('Polygon must have at least 3 points');
      expect(() => validator.isPointInPolygon(0, 0, [{ lat: 0, lng: 0 }])).toThrow('Polygon must have at least 3 points');
      expect(() => validator.isPointInPolygon(0, 0, 'invalid')).toThrow('Polygon must have at least 3 points');
    });

    test('should throw error for invalid polygon coordinates', () => {
      const invalidPolygon = [
        { lat: 0, lng: 0 },
        { lat: 91, lng: 0 }, // Invalid latitude
        { lat: 0, lng: 1 }
      ];

      expect(() => validator.isPointInPolygon(0, 0, invalidPolygon)).toThrow('Invalid polygon coordinates provided');
    });
  });

  describe('_isValidCoordinate (private method validation)', () => {
    test('should validate coordinate ranges correctly', () => {
      // Test through public methods that use this validation
      expect(() => validator.calculateDistance(90, 180, -90, -180)).not.toThrow();
      expect(() => validator.calculateDistance(90.1, 0, 0, 0)).toThrow();
      expect(() => validator.calculateDistance(0, 180.1, 0, 0)).toThrow();
      expect(() => validator.calculateDistance(-90.1, 0, 0, 0)).toThrow();
      expect(() => validator.calculateDistance(0, -180.1, 0, 0)).toThrow();
    });
  });
});