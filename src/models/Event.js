const { v4: uuidv4 } = require('crypto');

class Event {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.geofence = data.geofence || null;
    this.qrSettings = data.qrSettings || {
      expirationSeconds: 60,
      allowReuse: false
    };
    this.isActive = data.isActive || false;
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
  }

  validate() {
    const errors = [];

    // Validate name
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }
    if (this.name && this.name.length > 255) {
      errors.push('Name must be 255 characters or less');
    }

    // Validate description
    if (this.description && typeof this.description !== 'string') {
      errors.push('Description must be a string');
    }
    if (this.description && this.description.length > 1000) {
      errors.push('Description must be 1000 characters or less');
    }

    // Validate time ranges
    if (!this.startTime) {
      errors.push('Start time is required');
    }
    if (!this.endTime) {
      errors.push('End time is required');
    }
    
    if (this.startTime && this.endTime) {
      const start = new Date(this.startTime);
      const end = new Date(this.endTime);
      
      if (isNaN(start.getTime())) {
        errors.push('Start time must be a valid date');
      }
      if (isNaN(end.getTime())) {
        errors.push('End time must be a valid date');
      }
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start >= end) {
        errors.push('End time must be after start time');
      }
    }

    // Validate geofence data
    if (!this.geofence) {
      errors.push('Geofence configuration is required');
    } else {
      const geofenceErrors = this.validateGeofence(this.geofence);
      errors.push(...geofenceErrors);
    }

    // Validate QR settings
    if (this.qrSettings) {
      if (typeof this.qrSettings.expirationSeconds !== 'number' || 
          this.qrSettings.expirationSeconds < 30 || 
          this.qrSettings.expirationSeconds > 3600) {
        errors.push('QR expiration seconds must be a number between 30 and 3600');
      }
      if (typeof this.qrSettings.allowReuse !== 'boolean') {
        errors.push('QR allowReuse must be a boolean');
      }
    }

    // Validate createdBy
    if (!this.createdBy) {
      errors.push('CreatedBy is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateGeofence(geofence) {
    const errors = [];

    if (!geofence.type || !['circle', 'polygon'].includes(geofence.type)) {
      errors.push('Geofence type must be either "circle" or "polygon"');
      return errors;
    }

    if (!geofence.coordinates) {
      errors.push('Geofence coordinates are required');
      return errors;
    }

    if (geofence.type === 'circle') {
      // Validate circle geofence
      if (!geofence.coordinates.lat || !geofence.coordinates.lng) {
        errors.push('Circle geofence requires lat and lng coordinates');
      }
      
      if (typeof geofence.coordinates.lat !== 'number' || 
          geofence.coordinates.lat < -90 || 
          geofence.coordinates.lat > 90) {
        errors.push('Circle geofence latitude must be a number between -90 and 90');
      }
      
      if (typeof geofence.coordinates.lng !== 'number' || 
          geofence.coordinates.lng < -180 || 
          geofence.coordinates.lng > 180) {
        errors.push('Circle geofence longitude must be a number between -180 and 180');
      }
      
      if (!geofence.radius || typeof geofence.radius !== 'number' || geofence.radius <= 0) {
        errors.push('Circle geofence requires a positive radius in meters');
      }
      
      if (geofence.radius > 10000) {
        errors.push('Circle geofence radius cannot exceed 10000 meters');
      }
    } else if (geofence.type === 'polygon') {
      // Validate polygon geofence
      if (!Array.isArray(geofence.coordinates)) {
        errors.push('Polygon geofence coordinates must be an array');
      } else {
        if (geofence.coordinates.length < 3) {
          errors.push('Polygon geofence requires at least 3 coordinate points');
        }
        
        geofence.coordinates.forEach((point, index) => {
          if (!point.lat || !point.lng) {
            errors.push(`Polygon point ${index + 1} requires lat and lng coordinates`);
          }
          
          if (typeof point.lat !== 'number' || point.lat < -90 || point.lat > 90) {
            errors.push(`Polygon point ${index + 1} latitude must be a number between -90 and 90`);
          }
          
          if (typeof point.lng !== 'number' || point.lng < -180 || point.lng > 180) {
            errors.push(`Polygon point ${index + 1} longitude must be a number between -180 and 180`);
          }
        });
      }
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      startTime: this.startTime,
      endTime: this.endTime,
      geofence: this.geofence,
      qrSettings: this.qrSettings,
      isActive: this.isActive,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Event;