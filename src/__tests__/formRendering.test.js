const request = require('supertest');
const express = require('express');
const CheckinController = require('../controllers/checkinController');
const QRCodeGenerator = require('../services/QRCodeGenerator');

// Mock the QRCodeGenerator
jest.mock('../services/QRCodeGenerator');

describe('Form Rendering Endpoint', () => {
  let app;
  let checkinController;
  let mockQRGenerator;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Create controller instance
    checkinController = new CheckinController();

    // Mock QRCodeGenerator
    mockQRGenerator = {
      validateQRCode: jest.fn()
    };
    QRCodeGenerator.mockImplementation(() => mockQRGenerator);

    // Set up route
    app.get('/api/checkin/form/:eventId/:token', checkinController.getCheckinForm.bind(checkinController));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/checkin/form/:eventId/:token', () => {
    const validEventId = 'event-123';
    const validToken = 'valid-token-123';

    describe('Valid QR Token Scenarios', () => {
      test('should render HTML form when QR token is valid', async () => {
        // Mock valid QR token validation
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timestamp: Date.now() - 30000, // 30 seconds ago
          expiresAt: Date.now() + 30000, // 30 seconds from now
          timeRemaining: 30000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check content type
        expect(response.headers['content-type']).toMatch(/text\/html/);

        // Check HTML structure
        expect(response.text).toContain('<!DOCTYPE html>');
        expect(response.text).toContain('<title>Event Check-in</title>');
        expect(response.text).toContain('Event Check-in');
        expect(response.text).toContain('Time remaining:');

        // Check form elements
        expect(response.text).toContain('id="checkinForm"');
        expect(response.text).toContain('name="eventId"');
        expect(response.text).toContain('name="qrToken"');
        expect(response.text).toContain('id="name"');
        expect(response.text).toContain('id="email"');
        expect(response.text).toContain('id="idNumber"');
        expect(response.text).toContain('id="selfie"');

        // Check accessibility features
        expect(response.text).toContain('aria-label="required"');
        expect(response.text).toContain('aria-describedby');
        expect(response.text).toContain('aria-live="polite"');
        expect(response.text).toContain('autocomplete="name"');
        expect(response.text).toContain('autocomplete="email"');

        // Check mobile optimization
        expect(response.text).toContain('viewport');
        expect(response.text).toContain('@media (max-width: 480px)');

        // Check hidden form fields have correct values
        expect(response.text).toContain(`value="${validEventId}"`);
        expect(response.text).toContain(`value="${validToken}"`);

        // Verify QR validation was called
        expect(mockQRGenerator.validateQRCode).toHaveBeenCalledWith(validToken, validEventId);
      });

      test('should display correct time remaining in form', async () => {
        const timeRemaining = 120000; // 2 minutes
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check timer display
        expect(response.text).toContain('Time remaining: 2m 0s');
        
        // Check JavaScript timer initialization
        expect(response.text).toContain(`let timeRemaining = ${timeRemaining};`);
      });

      test('should include proper form validation and JavaScript functionality', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check JavaScript functions
        expect(response.text).toContain('function updateTimer()');
        expect(response.text).toContain('function validateForm()');
        expect(response.text).toContain('function isValidEmail(email)');
        expect(response.text).toContain('async function uploadSelfie(file)');
        expect(response.text).toContain('navigator.geolocation.getCurrentPosition');

        // Check form submission handling
        expect(response.text).toContain("form.addEventListener('submit'");
        expect(response.text).toContain("fetch('/api/checkin/submit'");

        // Check location handling
        expect(response.text).toContain("locationBtn.addEventListener('click'");
        expect(response.text).toContain('enableHighAccuracy: true');
      });
    });

    describe('Expired QR Token Scenarios', () => {
      test('should render error page when QR token is expired', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: false,
          isExpired: true,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          expiresAt: Date.now() - 10000, // expired 10 seconds ago
          timeRemaining: 0
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(400);

        // Check content type
        expect(response.headers['content-type']).toMatch(/text\/html/);

        // Check error page structure
        expect(response.text).toContain('<!DOCTYPE html>');
        expect(response.text).toContain('<title>QR Code Expired</title>');
        expect(response.text).toContain('QR Code Expired');
        expect(response.text).toContain('This QR code has expired');
        expect(response.text).toContain('QR_EXPIRED');
        expect(response.text).toContain('Scan QR Code Again');

        // Check accessibility
        expect(response.text).toContain('aria-label="Error code"');
        expect(response.text).toContain('aria-hidden="true"');

        // Should not contain form elements
        expect(response.text).not.toContain('id="checkinForm"');
      });

      test('should render error page when QR token is already used', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: false,
          isExpired: false,
          isUsed: true,
          isValidEvent: true,
          eventId: validEventId
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(400);

        expect(response.text).toContain('<title>QR Code Already Used</title>');
        expect(response.text).toContain('QR Code Already Used');
        expect(response.text).toContain('already been used');
        expect(response.text).toContain('QR_ALREADY_USED');
        expect(response.text).toContain('Scan QR Code Again');
      });

      test('should render error page when QR token is for wrong event', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: false,
          isExpired: false,
          isUsed: false,
          isValidEvent: false,
          eventId: 'different-event-id'
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(400);

        expect(response.text).toContain('<title>Invalid QR Code</title>');
        expect(response.text).toContain('Invalid QR Code');
        expect(response.text).toContain('not valid for this event');
        expect(response.text).toContain('INVALID_EVENT');
        expect(response.text).toContain('Scan QR Code Again');
      });

      test('should render generic error page for other validation failures', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: false,
          isExpired: false,
          isUsed: false,
          isValidEvent: true, // Set to true so it doesn't trigger INVALID_EVENT
          error: 'Token format invalid'
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(400);

        expect(response.text).toContain('<title>Invalid QR Code</title>');
        expect(response.text).toContain('Invalid QR Code');
        expect(response.text).toContain('not valid');
        expect(response.text).toContain('QR_VALIDATION_FAILED');
        expect(response.text).toContain('Scan QR Code Again');
      });
    });

    describe('Server Error Scenarios', () => {
      test('should render error page when QR validation throws exception', async () => {
        mockQRGenerator.validateQRCode.mockRejectedValue(new Error('Redis connection failed'));

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(500);

        expect(response.text).toContain('<title>Server Error</title>');
        expect(response.text).toContain('Server Error');
        expect(response.text).toContain('Unable to load the check-in form');
        expect(response.text).toContain('FORM_RETRIEVAL_ERROR');
        expect(response.text).toContain('Scan QR Code Again');
      });

      test('should handle missing parameters gracefully', async () => {
        const response = await request(app)
          .get('/api/checkin/form//')
          .expect(404);

        // Should get 404 for malformed URL
      });
    });

    describe('Accessibility Features', () => {
      test('should include proper ARIA labels and roles', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check ARIA attributes
        expect(response.text).toContain('aria-live="polite"');
        expect(response.text).toContain('aria-describedby="name-help"');
        expect(response.text).toContain('aria-describedby="email-help"');
        expect(response.text).toContain('aria-describedby="id-help"');
        expect(response.text).toContain('aria-describedby="selfie-help"');
        expect(response.text).toContain('aria-label="required"');
        expect(response.text).toContain('aria-hidden="true"');

        // Check form labels
        expect(response.text).toContain('<label for="name">');
        expect(response.text).toContain('<label for="email">');
        expect(response.text).toContain('<label for="idNumber">');
        expect(response.text).toContain('<label for="selfie">');

        // Check help text
        expect(response.text).toContain('id="name-help"');
        expect(response.text).toContain('id="email-help"');
        expect(response.text).toContain('id="id-help"');
        expect(response.text).toContain('id="selfie-help"');
      });

      test('should include high contrast and reduced motion support', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check CSS media queries for accessibility
        expect(response.text).toContain('@media (prefers-contrast: high)');
        expect(response.text).toContain('@media (prefers-reduced-motion: reduce)');
        expect(response.text).toContain('animation-duration: 0.01ms !important');
      });
    });

    describe('Mobile Optimization', () => {
      test('should include mobile viewport and responsive CSS', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check viewport meta tag
        expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');

        // Check responsive CSS
        expect(response.text).toContain('@media (max-width: 480px)');
        expect(response.text).toContain('font-size: 16px'); // Prevents zoom on iOS

        // Check mobile-specific attributes
        expect(response.text).toContain('capture="user"'); // Camera capture for selfie
        expect(response.text).toContain('accept="image/*"');
      });

      test('should include proper touch-friendly button sizes', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check button padding for touch targets
        expect(response.text).toContain('padding: 16px'); // Submit button
        expect(response.text).toContain('padding: 10px 16px'); // Location button
        expect(response.text).toContain('padding: 12px'); // Input fields
      });
    });

    describe('Security Features', () => {
      test('should include proper form validation and sanitization', async () => {
        mockQRGenerator.validateQRCode.mockResolvedValue({
          isValid: true,
          isExpired: false,
          isUsed: false,
          isValidEvent: true,
          eventId: validEventId,
          timeRemaining: 60000
        });

        const response = await request(app)
          .get(`/api/checkin/form/${validEventId}/${validToken}`)
          .expect(200);

        // Check form validation
        expect(response.text).toContain('novalidate'); // Custom validation
        expect(response.text).toContain('required');
        expect(response.text).toContain('.trim()'); // Input sanitization

        // Check hidden fields are properly escaped
        expect(response.text).toContain(`value="${validEventId}"`);
        expect(response.text).toContain(`value="${validToken}"`);
      });
    });
  });
});