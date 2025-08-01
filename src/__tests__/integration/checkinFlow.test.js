const request = require('supertest');
const express = require('express');
const checkinRoutes = require('../../routes/checkinRoutes');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/checkin', checkinRoutes);

describe('Check-in Flow Integration Tests', () => {
  describe('POST /api/checkin/submit', () => {
    it('should successfully submit check-in with valid location inside circular geofence', async () => {
      const checkinData = {
        eventId: 'test-event-id',
        userData: {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: '12345'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Check-in submitted successfully',
        data: {
          eventId: 'test-event-id',
          userData: checkinData.userData,
          location: checkinData.location,
          timestamp: expect.any(String),
          locationVerified: true,
          validationDetails: {
            distance: 0,
            geofenceType: 'circle'
          }
        }
      });
    });

    it('should reject check-in when user is outside geofence', async () => {
      const checkinData = {
        eventId: 'test-event-id',
        userData: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          idNumber: '67890'
        },
        location: {
          latitude: 37.8000,  // Far from the mock event center
          longitude: -122.5000
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'OUTSIDE_GEOFENCE',
          message: 'You are outside the event area. Please move closer to the event location.',
          details: {
            userDistance: expect.any(Number),
            allowedRadius: 100,
            geofenceType: 'circle'
          },
          action: 'move_closer'
        }
      });

      expect(response.body.error.details.userDistance).toBeGreaterThan(100);
    });

    it('should allow check-in with warning when no location is provided', async () => {
      const checkinData = {
        eventId: 'test-event-id',
        userData: {
          name: 'Bob Smith',
          email: 'bob@example.com',
          idNumber: '11111'
        },
        // No location provided
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Check-in submitted successfully',
        warning: 'Location not provided - incomplete verification',
        data: {
          eventId: 'test-event-id',
          userData: checkinData.userData,
          timestamp: expect.any(String),
          locationVerified: false
        }
      });
    });

    it('should return 404 when event is not found', async () => {
      const checkinData = {
        eventId: 'non-existent-event',
        userData: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          idNumber: '22222'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        qrToken: 'valid-token'
      };

      // Mock the getEventById to return null for this specific test
      const LocationValidationMiddleware = require('../../middleware/locationValidation');
      const originalGetEventById = LocationValidationMiddleware.prototype.getEventById;
      LocationValidationMiddleware.prototype.getEventById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'EVENT_NOT_FOUND',
          message: 'Event not found',
          details: { eventId: 'non-existent-event' }
        }
      });

      // Restore original method
      LocationValidationMiddleware.prototype.getEventById = originalGetEventById;
    });

    it('should handle multiple geofence types correctly', async () => {
      // Test with polygon geofence
      const LocationValidationMiddleware = require('../../middleware/locationValidation');
      const originalGetEventById = LocationValidationMiddleware.prototype.getEventById;
      
      const mockPolygonEvent = {
        id: 'polygon-event',
        name: 'Polygon Event',
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

      LocationValidationMiddleware.prototype.getEventById = jest.fn().mockResolvedValue(mockPolygonEvent);

      const checkinData = {
        eventId: 'polygon-event',
        userData: {
          name: 'Polygon User',
          email: 'polygon@example.com',
          idNumber: '33333'
        },
        location: {
          latitude: 37.7749,  // Inside the polygon
          longitude: -122.4150
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.locationVerified).toBe(true);
      expect(response.body.data.validationDetails.geofenceType).toBe('polygon');

      // Restore original method
      LocationValidationMiddleware.prototype.getEventById = originalGetEventById;
    });

    it('should handle invalid location coordinates gracefully', async () => {
      const checkinData = {
        eventId: 'test-event-id',
        userData: {
          name: 'Invalid Location User',
          email: 'invalid@example.com',
          idNumber: '44444'
        },
        location: {
          latitude: 'invalid',  // Invalid coordinate
          longitude: -122.4194
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'LOCATION_VALIDATION_ERROR',
          message: 'Failed to validate location',
          details: {
            originalError: expect.any(String)
          }
        }
      });
    });
  });

  describe('GET /api/checkin/form/:eventId/:token', () => {
    it('should return check-in form configuration', async () => {
      const response = await request(app)
        .get('/api/checkin/form/test-event/test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          eventId: 'test-event',
          formFields: [
            { name: 'name', type: 'text', required: true, label: 'Full Name' },
            { name: 'email', type: 'email', required: true, label: 'Email Address' },
            { name: 'idNumber', type: 'text', required: true, label: 'ID Number' },
            { name: 'selfie', type: 'file', required: false, label: 'Selfie (Optional)' }
          ],
          locationRequired: true,
          message: 'Please fill out the form and allow location access to complete check-in.'
        }
      });
    });
  });

  describe('Error Response Format Validation', () => {
    it('should return consistent error format for outside geofence scenarios', async () => {
      const checkinData = {
        eventId: 'test-event-id',
        userData: {
          name: 'Error Test User',
          email: 'error@example.com',
          idNumber: '55555'
        },
        location: {
          latitude: 40.0000,  // Very far from mock event
          longitude: -120.0000
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(400);

      // Verify error response structure matches requirements
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'OUTSIDE_GEOFENCE');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('details');
      expect(response.body.error).toHaveProperty('action', 'move_closer');
      
      // Verify details contain required information
      expect(response.body.error.details).toHaveProperty('userDistance');
      expect(response.body.error.details).toHaveProperty('allowedRadius');
      expect(response.body.error.details).toHaveProperty('geofenceType');
    });

    it('should provide specific error messages for different validation failures', async () => {
      // Test inactive event scenario
      const LocationValidationMiddleware = require('../../middleware/locationValidation');
      const originalGetEventById = LocationValidationMiddleware.prototype.getEventById;
      
      const mockInactiveEvent = {
        id: 'inactive-event',
        name: 'Inactive Event',
        isActive: false,
        geofence: {
          type: 'circle',
          coordinates: { lat: 37.7749, lng: -122.4194 },
          radius: 100
        }
      };

      LocationValidationMiddleware.prototype.getEventById = jest.fn().mockResolvedValue(mockInactiveEvent);

      const checkinData = {
        eventId: 'inactive-event',
        userData: {
          name: 'Inactive Test User',
          email: 'inactive@example.com',
          idNumber: '66666'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        qrToken: 'valid-token'
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(checkinData)
        .expect(400);

      expect(response.body.error.code).toBe('EVENT_INACTIVE');
      expect(response.body.error.message).toBe('Event is not currently active');

      // Restore original method
      LocationValidationMiddleware.prototype.getEventById = originalGetEventById;
    });
  });
});