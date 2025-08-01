/**
 * GeofenceValidator - Handles geofence calculations for event check-ins
 * Supports both circular and polygon geofences with distance calculations
 */
class GeofenceValidator {
  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lng1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lng2 - Longitude of second point
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    // Validate input coordinates
    if (!this._isValidCoordinate(lat1, lng1) || !this._isValidCoordinate(lat2, lng2)) {
      throw new Error('Invalid coordinates provided');
    }

    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if a point is within a circular geofence
   * @param {number} lat - Point latitude
   * @param {number} lng - Point longitude
   * @param {number} centerLat - Circle center latitude
   * @param {number} centerLng - Circle center longitude
   * @param {number} radius - Circle radius in meters
   * @returns {boolean} True if point is inside circle
   */
  isPointInCircle(lat, lng, centerLat, centerLng, radius) {
    // Validate inputs
    if (!this._isValidCoordinate(lat, lng) || !this._isValidCoordinate(centerLat, centerLng)) {
      throw new Error('Invalid coordinates provided');
    }
    if (typeof radius !== 'number' || radius <= 0) {
      throw new Error('Radius must be a positive number');
    }

    const distance = this.calculateDistance(lat, lng, centerLat, centerLng);
    return distance <= radius;
  }

  /**
   * Check if a point is within a polygon geofence using ray casting algorithm
   * @param {number} lat - Point latitude
   * @param {number} lng - Point longitude
   * @param {Array} polygonPoints - Array of {lat, lng} objects defining polygon vertices
   * @returns {boolean} True if point is inside polygon
   */
  isPointInPolygon(lat, lng, polygonPoints) {
    // Validate inputs
    if (!this._isValidCoordinate(lat, lng)) {
      throw new Error('Invalid point coordinates provided');
    }
    if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }

    // Validate all polygon points
    for (const point of polygonPoints) {
      if (!this._isValidCoordinate(point.lat, point.lng)) {
        throw new Error('Invalid polygon coordinates provided');
      }
    }

    let inside = false;
    const x = lng;
    const y = lat;

    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].lng;
      const yi = polygonPoints[i].lat;
      const xj = polygonPoints[j].lng;
      const yj = polygonPoints[j].lat;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Validate if coordinates are within valid ranges
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean} True if coordinates are valid
   * @private
   */
  _isValidCoordinate(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' &&
           lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180 &&
           !isNaN(lat) && !isNaN(lng);
  }
}

module.exports = GeofenceValidator;