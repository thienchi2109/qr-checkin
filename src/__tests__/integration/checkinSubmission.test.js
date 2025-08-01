const request = require('supertest');
const express = require('express');
const cors = require('cors');
const checkinRoutes = require('../../routes/checkinRoutes');

// Mock the services to avoid external dependencies
jest.mock('../../services/QRCodeGenerator');
jest.mock('../../services/QRCodeCacheService');
jest.mock('../../services/GeofenceValidator');

const QRCodeGenerator = require('../../services/QRCodeGenerator');
const GeofenceValidator = require('../../services/GeofenceValidator');

describe('POST /api/checkin/submit - Integration Tests', () => {
  let app;
  let mockQRGenerator;
  let mockGeofenceValidator;

  beforeAll(() => {
    // Setup Express app for testing
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/checkin', checkinRoutes);

    // Setup mocks
    mockQRGenerator = {
      validateQRCode: jest.fn(),
      markTokenAsUsed: jest.fn()
    };
    mockGeofenceValidator = {
      isPointInCircle: jest.fn(),
      calculateDistance: jest.fn()
    };

    QRCodeGenerator.mockImplementation(() => mockQRGenerator);
    GeofenceValidator.mockImplementation(() => mockGeofenceValidator);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Submissions', () => {
    test('should successfully submit check-in with valid data and location', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      // Mock geofence validation success
      mockGeofenceValidator.isPointInCircle.mockReturnValue(true);
      mockGeofenceValidator.calculateDistance.mockReturnValue(50);

      const validPayload = {
        eventId: 'event123',
        qrToken: 'valid_encrypted_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'https://example.com/selfie.jpg'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(validPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Check-in submitted successfully');
      expect(response.body.data.checkinId).toBeDefined();
      expect(response.body.data.eventId).toBe('event123');
      expect(response.body.data.locationVerified).toBe(true);
      expect(response.body.data.validationDetails).toBeDefined();
      expect(response.body.data.qrValidation.isValid).toBe(true);
    });

    test('should successfully submit check-in without location (with warning)', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithoutLocation = {
        eventId: 'event123',
        qrToken: 'valid_encrypted_token',
        userData: {
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          idNumber: 'ID789012'
        }
        // No location provided
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithoutLocation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.warning).toBeDefined();
      expect(response.body.data.locationVerified).toBe(false);
      expect(response.body.data.locationWarning).toBeDefined();
    });
  });

  describe('QR Token Validation Failures', () => {
    test('should reject submission with missing QR token', async () => {
      const payloadWithoutToken = {
        eventId: 'event123',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithoutToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QR_TOKEN_MISSING');
      expect(response.body.error.action).toBe('scan_qr_code');
    });

    test('should reject submission with expired QR token', async () => {
      // Mock QR validation failure - expired
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: false,
        isExpired: true,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now() - 120000,
        expiresAt: Date.now() - 60000,
        timeRemaining: 0
      });

      const payloadWithExpiredToken = {
        eventId: 'event123',
        qrToken: 'expired_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithExpiredToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QR_EXPIRED');
      expect(response.body.error.action).toBe('refresh_qr');
      expect(response.body.error.details.timeRemaining).toBe(0);
    });

    test('should reject submission with already used QR token', async () => {
      // Mock QR validation failure - already used
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: false,
        isExpired: false,
        isUsed: true,
        isValidEvent: true,
        eventId: 'event123'
      });

      const payloadWithUsedToken = {
        eventId: 'event123',
        qrToken: 'used_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithUsedToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QR_ALREADY_USED');
      expect(response.body.error.action).toBe('refresh_qr');
    });

    test('should reject submission with invalid event QR token', async () => {
      // Mock QR validation failure - wrong event
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: false,
        isExpired: false,
        isUsed: false,
        isValidEvent: false,
        eventId: 'different_event',
        actualEventId: 'different_event'
      });

      const payloadWithWrongEventToken = {
        eventId: 'event123',
        qrToken: 'wrong_event_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithWrongEventToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EVENT');
      expect(response.body.error.details.expectedEventId).toBe('event123');
      expect(response.body.error.details.actualEventId).toBe('different_event');
    });
  });

  describe('Location Validation Failures', () => {
    test('should reject submission when outside geofence', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });

      // Mock geofence validation failure
      mockGeofenceValidator.isPointInCircle.mockReturnValue(false);
      mockGeofenceValidator.calculateDistance.mockReturnValue(150); // Outside 100m radius

      const payloadOutsideGeofence = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7850, // Far from event location
          longitude: -122.4094,
          accuracy: 10
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadOutsideGeofence)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OUTSIDE_GEOFENCE');
      expect(response.body.error.action).toBe('move_closer');
      expect(response.body.error.details.userDistance).toBe(150);
      expect(response.body.error.details.allowedRadius).toBe(100);
    });
  });

  describe('Form Validation Failures', () => {
    test('should reject submission with missing user data', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithoutUserData = {
        eventId: 'event123',
        qrToken: 'valid_token',
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
        // Missing userData
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithoutUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors.userData).toBeDefined();
    });

    test('should reject submission with invalid email format', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithInvalidEmail = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'John Doe',
          email: 'invalid-email-format', // Invalid email
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithInvalidEmail)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors.userData.email).toContain('valid email address');
    });

    test('should reject submission with invalid location coordinates', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithInvalidLocation = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 95, // Invalid latitude (> 90)
          longitude: -200, // Invalid longitude (< -180)
          accuracy: -5 // Invalid accuracy (negative)
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithInvalidLocation)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors.location.latitude).toContain('between -90 and 90');
      expect(response.body.error.fieldErrors.location.longitude).toContain('between -180 and 180');
      expect(response.body.error.fieldErrors.location.accuracy).toContain('positive number');
    });

    test('should reject submission with missing required fields', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithMissingFields = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: '', // Empty name
          email: 'john.doe@example.com',
          // Missing idNumber
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithMissingFields)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors.userData.name).toContain('non-empty string');
      expect(response.body.error.fieldErrors.userData.idNumber).toContain('required');
    });
  });

  describe('Error Handling', () => {
    test('should handle QR validation service errors gracefully', async () => {
      // Mock QR validation service error
      mockQRGenerator.validateQRCode.mockRejectedValue(new Error('Redis connection failed'));

      const validPayload = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(validPayload)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QR_VALIDATION_ERROR');
      expect(response.body.error.details.originalError).toContain('Redis connection failed');
    });

    test('should handle geofence validation service errors gracefully', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      // Mock geofence validation error
      mockGeofenceValidator.isPointInCircle.mockImplementation(() => {
        throw new Error('Invalid coordinates provided');
      });

      const validPayload = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(validPayload)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOCATION_VALIDATION_ERROR');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long field values', async () => {
      // Mock QR validation success
      mockQRGenerator.validateQRCode.mockResolvedValue({
        isValid: true,
        isExpired: false,
        isUsed: false,
        isValidEvent: true,
        eventId: 'event123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
        timeRemaining: 60000
      });
      mockQRGenerator.markTokenAsUsed.mockResolvedValue(true);

      const payloadWithLongValues = {
        eventId: 'event123',
        qrToken: 'valid_token',
        userData: {
          name: 'A'.repeat(101), // Exceeds 100 character limit
          email: 'user@' + 'a'.repeat(250) + '.com', // Exceeds 255 character limit
          idNumber: 'ID' + '1'.repeat(49) // Exceeds 50 character limit
        },
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/checkin/submit')
        .send(payloadWithLongValues)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fieldErrors.userData.name).toContain('100 characters or less');
      expect(response.body.error.fieldErrors.userData.email).toContain('255 characters or less');
      expect(response.body.error.fieldErrors.userData.idNumber).toContain('50 characters or less');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/checkin/submit')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      // Express should handle this and return a 400 error
      expect(response.status).toBe(400);
    });
  });
});