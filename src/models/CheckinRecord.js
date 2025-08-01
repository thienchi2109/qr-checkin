class CheckinRecord {
  constructor(data = {}) {
    this.id = data.id || null;
    this.eventId = data.eventId || null;
    this.userData = data.userData || null;
    this.location = data.location || null;
    this.qrToken = data.qrToken || null;
    this.checkinTime = data.checkinTime || null;
    this.ipAddress = data.ipAddress || null;
    this.userAgent = data.userAgent || null;
    this.validationStatus = data.validationStatus || 'success';
    this.validationErrors = data.validationErrors || null;
  }

  validate() {
    const errors = [];

    // Validate eventId
    if (!this.eventId) {
      errors.push('Event ID is required');
    }

    // Validate userData
    if (!this.userData || typeof this.userData !== 'object') {
      errors.push('User data is required and must be an object');
    } else {
      const userDataErrors = this.validateUserData(this.userData);
      errors.push(...userDataErrors);
    }

    // Validate location data
    if (!this.location) {
      errors.push('Location data is required');
    } else {
      const locationErrors = this.validateLocation(this.location);
      errors.push(...locationErrors);
    }

    // Validate qrToken
    if (!this.qrToken || typeof this.qrToken !== 'string') {
      errors.push('QR token is required and must be a string');
    }

    // Validate checkinTime
    if (!this.checkinTime) {
      errors.push('Check-in time is required');
    } else {
      const checkinDate = new Date(this.checkinTime);
      if (isNaN(checkinDate.getTime())) {
        errors.push('Check-in time must be a valid date');
      }
    }

    // Validate validationStatus
    if (!['success', 'failed'].includes(this.validationStatus)) {
      errors.push('Validation status must be either "success" or "failed"');
    }

    // Validate validationErrors (if present)
    if (this.validationErrors !== null && !Array.isArray(this.validationErrors)) {
      errors.push('Validation errors must be an array or null');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateUserData(userData) {
    const errors = [];

    // Validate name
    if (!userData.name || typeof userData.name !== 'string' || userData.name.trim().length === 0) {
      errors.push('User name is required and must be a non-empty string');
    }
    if (userData.name && userData.name.length > 100) {
      errors.push('User name must be 100 characters or less');
    }

    // Validate email
    if (!userData.email || typeof userData.email !== 'string') {
      errors.push('User email is required and must be a string');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        errors.push('User email must be a valid email address');
      }
      if (userData.email.length > 255) {
        errors.push('User email must be 255 characters or less');
      }
    }

    // Validate idNumber
    if (!userData.idNumber || typeof userData.idNumber !== 'string' || userData.idNumber.trim().length === 0) {
      errors.push('User ID number is required and must be a non-empty string');
    }
    if (userData.idNumber && userData.idNumber.length > 50) {
      errors.push('User ID number must be 50 characters or less');
    }

    // Validate selfieUrl (optional)
    if (userData.selfieUrl !== undefined && userData.selfieUrl !== null) {
      if (typeof userData.selfieUrl !== 'string') {
        errors.push('Selfie URL must be a string');
      } else if (userData.selfieUrl.length > 500) {
        errors.push('Selfie URL must be 500 characters or less');
      }
      // Basic URL validation
      try {
        new URL(userData.selfieUrl);
      } catch {
        errors.push('Selfie URL must be a valid URL');
      }
    }

    return errors;
  }

  validateLocation(location) {
    const errors = [];

    // Validate latitude
    if (typeof location.latitude !== 'number') {
      errors.push('Location latitude is required and must be a number');
    } else if (location.latitude < -90 || location.latitude > 90) {
      errors.push('Location latitude must be between -90 and 90');
    }

    // Validate longitude
    if (typeof location.longitude !== 'number') {
      errors.push('Location longitude is required and must be a number');
    } else if (location.longitude < -180 || location.longitude > 180) {
      errors.push('Location longitude must be between -180 and 180');
    }

    // Validate accuracy (optional but should be positive if provided)
    if (location.accuracy !== undefined && location.accuracy !== null) {
      if (typeof location.accuracy !== 'number' || location.accuracy < 0) {
        errors.push('Location accuracy must be a positive number');
      }
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      eventId: this.eventId,
      userData: this.userData,
      location: this.location,
      qrToken: this.qrToken,
      checkinTime: this.checkinTime,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      validationStatus: this.validationStatus,
      validationErrors: this.validationErrors
    };
  }
}

module.exports = CheckinRecord;