const Event = require('../../models/Event');

describe('Event Model', () => {
    describe('constructor', () => {
        it('should create an event with default values', () => {
            const event = new Event();

            expect(event.id).toBeNull();
            expect(event.name).toBe('');
            expect(event.description).toBe('');
            expect(event.startTime).toBeNull();
            expect(event.endTime).toBeNull();
            expect(event.geofence).toBeNull();
            expect(event.qrSettings).toEqual({
                expirationSeconds: 60,
                allowReuse: false
            });
            expect(event.isActive).toBe(false);
            expect(event.createdBy).toBeNull();
            expect(event.createdAt).toBeNull();
            expect(event.updatedAt).toBeNull();
        });

        it('should create an event with provided data', () => {
            const eventData = {
                id: 'test-id',
                name: 'Test Event',
                description: 'Test Description',
                startTime: '2024-01-01T10:00:00Z',
                endTime: '2024-01-01T18:00:00Z',
                geofence: {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: 100
                },
                qrSettings: {
                    expirationSeconds: 120,
                    allowReuse: true
                },
                isActive: true,
                createdBy: 'admin-id',
                createdAt: '2024-01-01T09:00:00Z',
                updatedAt: '2024-01-01T09:00:00Z'
            };

            const event = new Event(eventData);

            expect(event.id).toBe('test-id');
            expect(event.name).toBe('Test Event');
            expect(event.description).toBe('Test Description');
            expect(event.startTime).toBe('2024-01-01T10:00:00Z');
            expect(event.endTime).toBe('2024-01-01T18:00:00Z');
            expect(event.geofence).toEqual(eventData.geofence);
            expect(event.qrSettings).toEqual(eventData.qrSettings);
            expect(event.isActive).toBe(true);
            expect(event.createdBy).toBe('admin-id');
        });
    });

    describe('validate', () => {
        let validEventData;

        beforeEach(() => {
            validEventData = {
                name: 'Test Event',
                description: 'Test Description',
                startTime: '2024-01-01T10:00:00Z',
                endTime: '2024-01-01T18:00:00Z',
                geofence: {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: 100
                },
                createdBy: 'admin-id'
            };
        });

        it('should validate a valid event', () => {
            const event = new Event(validEventData);
            const validation = event.validate();

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        describe('name validation', () => {
            it('should require name', () => {
                const event = new Event({ ...validEventData, name: '' });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Name is required and must be a non-empty string');
            });

            it('should reject non-string name', () => {
                const event = new Event({ ...validEventData, name: 123 });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Name is required and must be a non-empty string');
            });

            it('should reject name longer than 255 characters', () => {
                const event = new Event({ ...validEventData, name: 'a'.repeat(256) });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Name must be 255 characters or less');
            });
        });

        describe('description validation', () => {
            it('should allow empty description', () => {
                const event = new Event({ ...validEventData, description: '' });
                const validation = event.validate();

                expect(validation.isValid).toBe(true);
            });

            it('should reject non-string description', () => {
                const event = new Event({ ...validEventData, description: 123 });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Description must be a string');
            });

            it('should reject description longer than 1000 characters', () => {
                const event = new Event({ ...validEventData, description: 'a'.repeat(1001) });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Description must be 1000 characters or less');
            });
        });

        describe('time validation', () => {
            it('should require start time', () => {
                const event = new Event({ ...validEventData, startTime: null });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Start time is required');
            });

            it('should require end time', () => {
                const event = new Event({ ...validEventData, endTime: null });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('End time is required');
            });

            it('should reject invalid start time', () => {
                const event = new Event({ ...validEventData, startTime: 'invalid-date' });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('Start time must be a valid date');
            });

            it('should reject invalid end time', () => {
                const event = new Event({ ...validEventData, endTime: 'invalid-date' });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('End time must be a valid date');
            });

            it('should reject end time before start time', () => {
                const event = new Event({
                    ...validEventData,
                    startTime: '2024-01-01T18:00:00Z',
                    endTime: '2024-01-01T10:00:00Z'
                });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('End time must be after start time');
            });

            it('should reject equal start and end times', () => {
                const event = new Event({
                    ...validEventData,
                    startTime: '2024-01-01T10:00:00Z',
                    endTime: '2024-01-01T10:00:00Z'
                });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('End time must be after start time');
            });
        });

        describe('QR settings validation', () => {
            it('should reject expiration seconds outside valid range', () => {
                const event = new Event({
                    ...validEventData,
                    qrSettings: { expirationSeconds: 20, allowReuse: false }
                });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('QR expiration seconds must be a number between 30 and 3600');
            });

            it('should reject non-boolean allowReuse', () => {
                const event = new Event({
                    ...validEventData,
                    qrSettings: { expirationSeconds: 60, allowReuse: 'true' }
                });
                const validation = event.validate();

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toContain('QR allowReuse must be a boolean');
            });
        });

        it('should require createdBy', () => {
            const event = new Event({ ...validEventData, createdBy: null });
            const validation = event.validate();

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('CreatedBy is required');
        });
    });

    describe('validateGeofence', () => {
        let event;

        beforeEach(() => {
            event = new Event();
        });

        it('should require geofence configuration', () => {
            const eventData = {
                name: 'Test Event',
                startTime: '2024-01-01T10:00:00Z',
                endTime: '2024-01-01T18:00:00Z',
                createdBy: 'admin-id'
            };
            const testEvent = new Event(eventData);
            const validation = testEvent.validate();

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Geofence configuration is required');
        });

        it('should reject invalid geofence type', () => {
            const geofence = { type: 'invalid', coordinates: {} };
            const errors = event.validateGeofence(geofence);

            expect(errors).toContain('Geofence type must be either "circle" or "polygon"');
        });

        it('should require coordinates', () => {
            const geofence = { type: 'circle' };
            const errors = event.validateGeofence(geofence);

            expect(errors).toContain('Geofence coordinates are required');
        });

        describe('circle geofence validation', () => {
            it('should validate a valid circle geofence', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: 100
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toHaveLength(0);
            });

            it('should require lat and lng for circle', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 40.7128 },
                    radius: 100
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Circle geofence requires lat and lng coordinates');
            });

            it('should validate latitude range', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 91, lng: -74.0060 },
                    radius: 100
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Circle geofence latitude must be a number between -90 and 90');
            });

            it('should validate longitude range', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: 181 },
                    radius: 100
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Circle geofence longitude must be a number between -180 and 180');
            });

            it('should require positive radius', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: -10
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Circle geofence requires a positive radius in meters');
            });

            it('should limit maximum radius', () => {
                const geofence = {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: 15000
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Circle geofence radius cannot exceed 10000 meters');
            });
        });

        describe('polygon geofence validation', () => {
            it('should validate a valid polygon geofence', () => {
                const geofence = {
                    type: 'polygon',
                    coordinates: [
                        { lat: 40.7128, lng: -74.0060 },
                        { lat: 40.7130, lng: -74.0058 },
                        { lat: 40.7126, lng: -74.0055 }
                    ]
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toHaveLength(0);
            });

            it('should require coordinates array', () => {
                const geofence = {
                    type: 'polygon',
                    coordinates: 'not-an-array'
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Polygon geofence coordinates must be an array');
            });

            it('should require at least 3 points', () => {
                const geofence = {
                    type: 'polygon',
                    coordinates: [
                        { lat: 40.7128, lng: -74.0060 },
                        { lat: 40.7130, lng: -74.0058 }
                    ]
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Polygon geofence requires at least 3 coordinate points');
            });

            it('should validate each point coordinates', () => {
                const geofence = {
                    type: 'polygon',
                    coordinates: [
                        { lat: 40.7128, lng: -74.0060 },
                        { lat: 91, lng: -74.0058 },
                        { lng: -74.0055 }
                    ]
                };
                const errors = event.validateGeofence(geofence);

                expect(errors).toContain('Polygon point 2 latitude must be a number between -90 and 90');
                expect(errors).toContain('Polygon point 3 requires lat and lng coordinates');
            });
        });
    });

    describe('toJSON', () => {
        it('should return all properties as JSON', () => {
            const eventData = {
                id: 'test-id',
                name: 'Test Event',
                description: 'Test Description',
                startTime: '2024-01-01T10:00:00Z',
                endTime: '2024-01-01T18:00:00Z',
                geofence: {
                    type: 'circle',
                    coordinates: { lat: 40.7128, lng: -74.0060 },
                    radius: 100
                },
                qrSettings: {
                    expirationSeconds: 120,
                    allowReuse: true
                },
                isActive: true,
                createdBy: 'admin-id',
                createdAt: '2024-01-01T09:00:00Z',
                updatedAt: '2024-01-01T09:00:00Z'
            };

            const event = new Event(eventData);
            const json = event.toJSON();

            expect(json).toEqual(eventData);
        });
    });
});