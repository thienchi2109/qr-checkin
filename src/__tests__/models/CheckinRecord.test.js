const CheckinRecord = require('../../models/CheckinRecord');

describe('CheckinRecord Model', () => {
  describe('constructor', () => {
    it('should create a checkin record with default values', () => {
      const record = new CheckinRecord();
      
      expect(record.id).toBeNull();
      expect(record.eventId).toBeNull();
      expect(record.userData).toBeNull();
      expect(record.location).toBeNull();
      expect(record.qrToken).toBeNull();
      expect(record.checkinTime).toBeNull();
      expect(record.ipAddress).toBeNull();
      expect(record.userAgent).toBeNull();
      expect(record.validationStatus).toBe('success');
      expect(record.validationErrors).toBeNull();
    });

    it('should create a checkin record with provided data', () => {
      const recordData = {
        id: 'test-id',
        eventId: 'event-123',
        userData: {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'https://example.com/selfie.jpg'
        },
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        },
        qrToken: 'token-123',
        checkinTime: '2024-01-01T12:00:00Z',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        validationStatus: 'success',
        validationErrors: null
      };

      const record = new CheckinRecord(recordData);
      
      expect(record.id).toBe('test-id');
      expect(record.eventId).toBe('event-123');
      expect(record.userData).toEqual(recordData.userData);
      expect(record.location).toEqual(recordData.location);
      expect(record.qrToken).toBe('token-123');
      expect(record.checkinTime).toBe('2024-01-01T12:00:00Z');
      expect(record.ipAddress).toBe('192.168.1.1');
      expect(record.userAgent).toBe('Mozilla/5.0');
      expect(record.validationStatus).toBe('success');
      expect(record.validationErrors).toBeNull();
    });
  });

  describe('validate', () => {
    let validRecordData;

    beforeEach(() => {
      validRecordData = {
        eventId: 'event-123',
        userData: {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456'
        },
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        },
        qrToken: 'token-123',
        checkinTime: '2024-01-01T12:00:00Z'
      };
    });

    it('should validate a valid checkin record', () => {
      const record = new CheckinRecord(validRecordData);
      const validation = record.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require eventId', () => {
      const record = new CheckinRecord({ ...validRecordData, eventId: null });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Event ID is required');
    });

    it('should require userData object', () => {
      const record = new CheckinRecord({ ...validRecordData, userData: null });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('User data is required and must be an object');
    });

    it('should require location data', () => {
      const record = new CheckinRecord({ ...validRecordData, location: null });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Location data is required');
    });

    it('should require qrToken', () => {
      const record = new CheckinRecord({ ...validRecordData, qrToken: null });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('QR token is required and must be a string');
    });

    it('should require checkinTime', () => {
      const record = new CheckinRecord({ ...validRecordData, checkinTime: null });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Check-in time is required');
    });

    it('should validate checkinTime as valid date', () => {
      const record = new CheckinRecord({ ...validRecordData, checkinTime: 'invalid-date' });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Check-in time must be a valid date');
    });

    it('should validate validationStatus values', () => {
      const record = new CheckinRecord({ ...validRecordData, validationStatus: 'invalid' });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Validation status must be either "success" or "failed"');
    });

    it('should validate validationErrors as array or null', () => {
      const record = new CheckinRecord({ ...validRecordData, validationErrors: 'not-array' });
      const validation = record.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Validation errors must be an array or null');
    });
  });

  describe('validateUserData', () => {
    let record;

    beforeEach(() => {
      record = new CheckinRecord();
    });

    it('should validate valid user data', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        idNumber: 'ID123456'
      };
      const errors = record.validateUserData(userData);
      
      expect(errors).toHaveLength(0);
    });

    describe('name validation', () => {
      it('should require name', () => {
        const userData = {
          name: '',
          email: 'john@example.com',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User name is required and must be a non-empty string');
      });

      it('should reject non-string name', () => {
        const userData = {
          name: 123,
          email: 'john@example.com',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User name is required and must be a non-empty string');
      });

      it('should reject name longer than 100 characters', () => {
        const userData = {
          name: 'a'.repeat(101),
          email: 'john@example.com',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User name must be 100 characters or less');
      });
    });

    describe('email validation', () => {
      it('should require email', () => {
        const userData = {
          name: 'John Doe',
          email: '',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User email is required and must be a string');
      });

      it('should validate email format', () => {
        const userData = {
          name: 'John Doe',
          email: 'invalid-email',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User email must be a valid email address');
      });

      it('should reject email longer than 255 characters', () => {
        const userData = {
          name: 'John Doe',
          email: 'a'.repeat(250) + '@example.com',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User email must be 255 characters or less');
      });
    });

    describe('idNumber validation', () => {
      it('should require idNumber', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: ''
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User ID number is required and must be a non-empty string');
      });

      it('should reject idNumber longer than 50 characters', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'a'.repeat(51)
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('User ID number must be 50 characters or less');
      });
    });

    describe('selfieUrl validation', () => {
      it('should allow undefined selfieUrl', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toHaveLength(0);
      });

      it('should allow null selfieUrl', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: null
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toHaveLength(0);
      });

      it('should validate selfieUrl as string', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 123
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('Selfie URL must be a string');
      });

      it('should validate selfieUrl length', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'https://example.com/' + 'a'.repeat(500)
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('Selfie URL must be 500 characters or less');
      });

      it('should validate selfieUrl format', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'not-a-url'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toContain('Selfie URL must be a valid URL');
      });

      it('should accept valid selfieUrl', () => {
        const userData = {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'https://example.com/selfie.jpg'
        };
        const errors = record.validateUserData(userData);
        
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('validateLocation', () => {
    let record;

    beforeEach(() => {
      record = new CheckinRecord();
    });

    it('should validate valid location data', () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      };
      const errors = record.validateLocation(location);
      
      expect(errors).toHaveLength(0);
    });

    describe('latitude validation', () => {
      it('should require latitude as number', () => {
        const location = {
          latitude: 'not-a-number',
          longitude: -74.0060
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location latitude is required and must be a number');
      });

      it('should validate latitude range', () => {
        const location = {
          latitude: 91,
          longitude: -74.0060
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location latitude must be between -90 and 90');
      });

      it('should validate negative latitude range', () => {
        const location = {
          latitude: -91,
          longitude: -74.0060
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location latitude must be between -90 and 90');
      });
    });

    describe('longitude validation', () => {
      it('should require longitude as number', () => {
        const location = {
          latitude: 40.7128,
          longitude: 'not-a-number'
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location longitude is required and must be a number');
      });

      it('should validate longitude range', () => {
        const location = {
          latitude: 40.7128,
          longitude: 181
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location longitude must be between -180 and 180');
      });

      it('should validate negative longitude range', () => {
        const location = {
          latitude: 40.7128,
          longitude: -181
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location longitude must be between -180 and 180');
      });
    });

    describe('accuracy validation', () => {
      it('should allow undefined accuracy', () => {
        const location = {
          latitude: 40.7128,
          longitude: -74.0060
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toHaveLength(0);
      });

      it('should allow null accuracy', () => {
        const location = {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: null
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toHaveLength(0);
      });

      it('should validate accuracy as positive number', () => {
        const location = {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: -5
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location accuracy must be a positive number');
      });

      it('should reject non-number accuracy', () => {
        const location = {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 'not-a-number'
        };
        const errors = record.validateLocation(location);
        
        expect(errors).toContain('Location accuracy must be a positive number');
      });
    });
  });

  describe('toJSON', () => {
    it('should return all properties as JSON', () => {
      const recordData = {
        id: 'test-id',
        eventId: 'event-123',
        userData: {
          name: 'John Doe',
          email: 'john@example.com',
          idNumber: 'ID123456',
          selfieUrl: 'https://example.com/selfie.jpg'
        },
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        },
        qrToken: 'token-123',
        checkinTime: '2024-01-01T12:00:00Z',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        validationStatus: 'success',
        validationErrors: null
      };

      const record = new CheckinRecord(recordData);
      const json = record.toJSON();
      
      expect(json).toEqual(recordData);
    });
  });
});