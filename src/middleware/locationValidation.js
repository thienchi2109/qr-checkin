const GeofenceValidator = require('../services/GeofenceValidator');
const Event = require('../models/Event');

/**
 * Location validation middleware for API endpoints
 * Validates user location against event geofence boundaries
 */
class LocationValidationMiddleware {
  constructor() {
    this.geofenceValidator = new GeofenceValidator();
  }

  /**
   * Middleware function to validate location for check-in requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  validateLocation = async (req, res, next) => {
    try {
      const { eventId, location } = req.body;

      // Skip validation if no location provided (optional based on requirements)
      if (!location || !location.latitude || !location.longitude) {
        req.locationValidation = {
          isValid: false,
          warning: 'Location not provided - incomplete verification',
          skipValidation: true
        };
        return next();
      }

      // Get event details to retrieve geofence configuration
      const event = await this.getEventById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Event not found',
            details: { eventId }
          }
        });
      }

      // Check if event is active
      if (!event.isActive) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EVENT_INACTIVE',
            message: 'Event is not currently active',
            details: { eventId, isActive: event.isActive }
          }
        });
      }

      // Validate location against geofence
      const validationResult = await this.validateLocationAgainstGeofence(
        location.latitude,
        location.longitude,
        event.geofence
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OUTSIDE_GEOFENCE',
            message: 'You are outside the event area. Please move closer to the event location.',
            details: {
              userDistance: validationResult.distance,
              allowedRadius: validationResult.allowedRadius,
              geofenceType: event.geofence.type
            },
            action: 'move_closer'
          }
        });
      }

      // Add validation result to request for use in subsequent middleware/controllers
      req.locationValidation = {
        isValid: true,
        distance: validationResult.distance,
        geofenceType: event.geofence.type
      };

      next();
    } catch (error) {
      console.error('Location validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOCATION_VALIDATION_ERROR',
          message: 'Failed to validate location',
          details: { originalError: error.message }
        }
      });
    }
  };

  /**
   * Validate location against different geofence types
   * @param {number} lat - User latitude
   * @param {number} lng - User longitude
   * @param {Object} geofence - Event geofence configuration
   * @returns {Object} Validation result
   */
  async validateLocationAgainstGeofence(lat, lng, geofence) {
    try {
      let isValid = false;
      let distance = null;
      let allowedRadius = null;

      if (geofence.type === 'circle') {
        // Validate against circular geofence
        isValid = this.geofenceValidator.isPointInCircle(
          lat,
          lng,
          geofence.coordinates.lat,
          geofence.coordinates.lng,
          geofence.radius
        );
        
        // Calculate actual distance for error reporting
        distance = this.geofenceValidator.calculateDistance(
          lat,
          lng,
          geofence.coordinates.lat,
          geofence.coordinates.lng
        );
        allowedRadius = geofence.radius;

      } else if (geofence.type === 'polygon') {
        // Validate against polygon geofence
        isValid = this.geofenceValidator.isPointInPolygon(
          lat,
          lng,
          geofence.coordinates
        );
        
        // For polygon, calculate distance to nearest edge (simplified)
        distance = this.calculateDistanceToPolygon(lat, lng, geofence.coordinates);
        allowedRadius = 0; // Inside polygon = 0 distance

      } else {
        throw new Error(`Unsupported geofence type: ${geofence.type}`);
      }

      return {
        isValid,
        distance: Math.round(distance),
        allowedRadius,
        geofenceType: geofence.type
      };

    } catch (error) {
      throw new Error(`Geofence validation failed: ${error.message}`);
    }
  }

  /**
   * Calculate approximate distance from point to polygon boundary
   * @param {number} lat - Point latitude
   * @param {number} lng - Point longitude
   * @param {Array} polygonPoints - Polygon vertices
   * @returns {number} Distance in meters
   */
  calculateDistanceToPolygon(lat, lng, polygonPoints) {
    // Simplified calculation - find distance to nearest vertex
    // In a production system, you'd calculate distance to nearest edge
    let minDistance = Infinity;
    
    for (const vertex of polygonPoints) {
      const distance = this.geofenceValidator.calculateDistance(
        lat, lng, vertex.lat, vertex.lng
      );
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  /**
   * Get event by ID (placeholder - will be replaced with actual database query)
   * @param {string} eventId - Event ID
   * @returns {Object|null} Event object or null
   */
  async getEventById(eventId) {
    // TODO: Replace with actual database query in subsequent tasks
    // For now, return a mock event for testing
    if (!eventId) return null;
    
    // Mock event data for testing
    return {
      id: eventId,
      name: 'Test Event',
      isActive: true,
      geofence: {
        type: 'circle',
        coordinates: { lat: 37.7749, lng: -122.4194 },
        radius: 100
      }
    };
  }
}

module.exports = LocationValidationMiddleware;