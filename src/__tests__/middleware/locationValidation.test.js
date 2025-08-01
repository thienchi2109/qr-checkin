const LocationValidationMiddleware = require('../../middleware/locationValidation');
const GeofenceValidator = require('../../services/GeofenceValidator');

describe('LocationValidationMiddleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = new LocationValidationMiddleware();
    mockReq = {
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('validateLocation', () => {
    it('should skip validation when no location is provided', async () => {
      mockReq.body = {
        eventId: 'test-event-id'
        // No location provided
      };

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockReq.locationValidation).toEqual({
        isValid: false,
        warning: 'Location not provided - incomplete verification',
        skipValidation: true
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 404 when event is not found', async () => {
      mockReq.body = {
        eventId: 'non-existent-event',
        location: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Mock getEventById to return null
      jest.spyOn(middleware, 'getEventById').mockResolvedValue(null);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found',
          details: { eventId: 'non-existent-event' }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when event is inactive', async () => {
      mockReq.body = {
        eventId: 'inactive-event',
        location: { latitude: 37.7749, longitude: -122.4194 }
      };

      const mockEvent = {
        id: 'inactive-event',
        isActive: false,
        geofence: {
          type: 'circle',
          coordinates: { lat: 37.7749, lng: -122.4194 },
          radius: 100
        }
      };

      jest.spyOn(middleware, 'getEventById').mockResolvedValue(mockEvent);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EVENT_INACTIVE',
          message: 'Event is not currently active',
          details: { eventId: 'inactive-event', isActive: false }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when user is outside circular geofence', async () => {
      mockReq.body = {
        eventId: 'test-event',
        location: { latitude: 37.8000, longitude: -122.5000 } // Far from center
      };

      const mockEvent = {
        id: 'test-event',
        isActive: true,
        geofence: {
          type: 'circle',
          coordinates: { lat: 37.7749, lng: -122.4194 },
          radius: 100
        }
      };

      jest.spyOn(middleware, 'getEventById').mockResolvedValue(mockEvent);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'OUTSIDE_GEOFENCE',
            message: 'You are outside the event area. Please move closer to the event location.',
            action: 'move_closer'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass validation when user is inside circular geofence', async () => {
      mockReq.body = {
        eventId: 'test-event',
        location: { latitude: 37.7749, longitude: -122.4194 } // Same as center
      };

      const mockEvent = {
        id: 'test-event',
        isActive: true,
        geofence: {
          type: 'circle',
          coordinates: { lat: 37.7749, lng: -122.4194 },
          radius: 100
        }
      };

      jest.spyOn(middleware, 'getEventById').mockResolvedValue(mockEvent);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockReq.locationValidation).toEqual({
        isValid: true,
        distance: 0,
        geofenceType: 'circle'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass validation when user is inside polygon geofence', async () => {
      mockReq.body = {
        eventId: 'test-event',
        location: { latitude: 37.7749, longitude: -122.4194 }
      };

      const mockEvent = {
        id: 'test-event',
        isActive: true,
        geofence: {
          type: 'polygon',
          coordinates: [
            { lat: 37.7700, lng: -122.4200 },
            { lat: 37.7800, lng: -122.4200 },
            { lat: 37.7800, lng: -122.4100 },
            { lat: 37.7700, lng: -122.4100 }
          ]
        }
      };

      jest.spyOn(middleware, 'getEventById').mockResolvedValue(mockEvent);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockReq.locationValidation).toEqual({
        isValid: true,
        distance: expect.any(Number),
        geofenceType: 'polygon'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 when user is outside polygon geofence', async () => {
      mockReq.body = {
        eventId: 'test-event',
        location: { latitude: 37.8000, longitude: -122.5000 } // Outside polygon
      };

      const mockEvent = {
        id: 'test-event',
        isActive: true,
        geofence: {
          type: 'polygon',
          coordinates: [
            { lat: 37.7700, lng: -122.4200 },
            { lat: 37.7800, lng: -122.4200 },
            { lat: 37.7800, lng: -122.4100 },
            { lat: 37.7700, lng: -122.4100 }
          ]
        }
      };

      jest.spyOn(middleware, 'getEventById').mockResolvedValue(mockEvent);

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'OUTSIDE_GEOFENCE',
            message: 'You are outside the event area. Please move closer to the event location.'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockReq.body = {
        eventId: 'test-event',
        location: { latitude: 37.7749, longitude: -122.4194 }
      };

      // Mock getEventById to throw an error
      jest.spyOn(middleware, 'getEventById').mockRejectedValue(new Error('Database error'));

      await middleware.validateLocation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'LOCATION_VALIDATION_ERROR',
          message: 'Failed to validate location',
          details: { originalError: 'Database error' }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateLocationAgainstGeofence', () => {
    it('should validate circular geofence correctly', async () => {
      const geofence = {
        type: 'circle',
        coordinates: { lat: 37.7749, lng: -122.4194 },
        radius: 100
      };

      const result = await middleware.validateLocationAgainstGeofence(
        37.7749, -122.4194, geofence
      );

      expect(result).toEqual({
        isValid: true,
        distance: 0,
        allowedRadius: 100,
        geofenceType: 'circle'
      });
    });

    it('should validate polygon geofence correctly', async () => {
      const geofence = {
        type: 'polygon',
        coordinates: [
          { lat: 37.7700, lng: -122.4200 },
          { lat: 37.7800, lng: -122.4200 },
          { lat: 37.7800, lng: -122.4100 },
          { lat: 37.7700, lng: -122.4100 }
        ]
      };

      const result = await middleware.validateLocationAgainstGeofence(
        37.7749, -122.4150, geofence
      );

      expect(result).toEqual({
        isValid: true,
        distance: expect.any(Number),
        allowedRadius: 0,
        geofenceType: 'polygon'
      });
    });

    it('should throw error for unsupported geofence type', async () => {
      const geofence = {
        type: 'unsupported',
        coordinates: { lat: 37.7749, lng: -122.4194 }
      };

      await expect(
        middleware.validateLocationAgainstGeofence(37.7749, -122.4194, geofence)
      ).rejects.toThrow('Geofence validation failed: Unsupported geofence type: unsupported');
    });
  });

  describe('calculateDistanceToPolygon', () => {
    it('should calculate distance to nearest polygon vertex', () => {
      const polygonPoints = [
        { lat: 37.7700, lng: -122.4200 },
        { lat: 37.7800, lng: -122.4200 },
        { lat: 37.7800, lng: -122.4100 },
        { lat: 37.7700, lng: -122.4100 }
      ];

      const distance = middleware.calculateDistanceToPolygon(
        37.7749, -122.4150, polygonPoints
      );

      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
    });
  });

  describe('getEventById', () => {
    it('should return null for invalid eventId', async () => {
      const result = await middleware.getEventById(null);
      expect(result).toBeNull();
    });

    it('should return mock event for valid eventId', async () => {
      const result = await middleware.getEventById('test-event-id');
      expect(result).toEqual({
        id: 'test-event-id',
        name: 'Test Event',
        isActive: true,
        geofence: {
          type: 'circle',
          coordinates: { lat: 37.7749, lng: -122.4194 },
          radius: 100
        }
      });
    });
  });
});