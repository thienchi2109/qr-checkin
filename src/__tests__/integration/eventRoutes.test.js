const request = require('supertest');
const express = require('express');
const { pool } = require('../../config/database');
const eventRoutes = require('../../routes/eventRoutes');
const { generateToken } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../middleware/auth');

describe('Event Routes Integration', () => {
  let app;
  let mockUser;
  let mockToken;
  let mockEvent;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/admin/events', eventRoutes);
  });

  beforeEach(() => {
    // Mock user and token
    mockUser = {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin'
    };

    mockToken = 'mock-jwt-token';

    // Mock event data
    mockEvent = {
      id: 'test-event-id',
      name: 'Test Event',
      description: 'Test event description',
      startTime: '2024-12-01T10:00:00Z',
      endTime: '2024-12-01T18:00:00Z',
      geofence: {
        type: 'circle',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        radius: 100
      },
      qrSettings: {
        expirationSeconds: 60,
        allowReuse: false
      },
      isActive: true,
      createdBy: mockUser.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock authentication middleware
    const { authenticateToken } = require('../../middleware/auth');
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Mock database pool
    pool.query = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/admin/events', () => {
    it('should create event with valid data', async () => {
      const eventData = {
        name: mockEvent.name,
        description: mockEvent.description,
        startTime: mockEvent.startTime,
        endTime: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qrSettings: mockEvent.qrSettings,
        isActive: mockEvent.isActive
      };

      const mockDbResult = {
        rows: [{
          id: mockEvent.id,
          name: mockEvent.name,
          description: mockEvent.description,
          start_time: mockEvent.startTime,
          end_time: mockEvent.endTime,
          geofence: mockEvent.geofence,
          qr_settings: mockEvent.qrSettings,
          is_active: mockEvent.isActive,
          created_by: mockUser.id,
          created_at: mockEvent.createdAt,
          updated_at: mockEvent.updatedAt
        }]
      };

      pool.query.mockResolvedValue(mockDbResult);

      const response = await request(app)
        .post('/api/admin/events')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Event created successfully',
        data: expect.objectContaining({
          id: mockEvent.id,
          name: mockEvent.name,
          description: mockEvent.description
        })
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.any(Array)
      );
    });

    it('should return 400 for invalid event data', async () => {
      const invalidEventData = {
        name: '', // Invalid: empty name
        startTime: mockEvent.startTime,
        endTime: mockEvent.endTime
      };

      const response = await request(app)
        .post('/api/admin/events')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidEventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('Name is required')
        ])
      });
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteEventData = {
        name: 'Test Event'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/admin/events')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(incompleteEventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('Start time is required'),
          expect.stringContaining('End time is required'),
          expect.stringContaining('Geofence configuration is required')
        ])
      });
    });
  });

  describe('GET /api/admin/events', () => {
    it('should get events with default pagination', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event 1',
          description: 'Description 1',
          start_time: '2024-12-01T10:00:00Z',
          end_time: '2024-12-01T18:00:00Z',
          geofence: mockEvent.geofence,
          qr_settings: mockEvent.qrSettings,
          is_active: true,
          created_by: mockUser.id,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // COUNT query
        .mockResolvedValueOnce({ rows: mockEvents }); // SELECT query

      const response = await request(app)
        .get('/api/admin/events')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'event-1',
            name: 'Event 1'
          })
        ]),
        pagination: expect.objectContaining({
          currentPage: 1,
          totalPages: 1,
          totalRecords: 1,
          limit: 10
        }),
        filters: expect.any(Object)
      });
    });

    it('should filter events by search query', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      const response = await request(app)
        .get('/api/admin/events')
        .query({ search: 'Test Event' })
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.filters.search).toBe('Test Event');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $'),
        expect.arrayContaining(['%Test Event%'])
      );
    });

    it('should handle pagination parameters', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '15' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/events')
        .query({ page: '2', limit: '5' })
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.pagination).toEqual({
        currentPage: 2,
        totalPages: 3,
        totalRecords: 15,
        limit: 5,
        hasNextPage: true,
        hasPrevPage: true
      });
    });
  });

  describe('GET /api/admin/events/:id', () => {
    it('should get event by ID', async () => {
      const dbEvent = {
        id: mockEvent.id,
        name: mockEvent.name,
        description: mockEvent.description,
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: mockEvent.isActive,
        created_by: mockUser.id,
        created_at: mockEvent.createdAt,
        updated_at: mockEvent.updatedAt
      };

      pool.query.mockResolvedValue({ rows: [dbEvent] });

      const response = await request(app)
        .get(`/api/admin/events/${mockEvent.id}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: mockEvent.id,
          name: mockEvent.name
        })
      });
    });

    it('should return 404 for non-existent event', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/admin/events/non-existent-id')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Event not found'
      });
    });
  });

  describe('PUT /api/admin/events/:id', () => {
    it('should update event successfully', async () => {
      const existingEvent = {
        id: mockEvent.id,
        name: 'Original Event',
        description: 'Original description',
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: true,
        created_by: mockUser.id,
        created_at: mockEvent.createdAt,
        updated_at: mockEvent.updatedAt
      };

      const updatedEvent = {
        ...existingEvent,
        name: 'Updated Event Name',
        description: 'Updated description'
      };

      const updateData = {
        name: 'Updated Event Name',
        description: 'Updated description'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [existingEvent] }) // SELECT existing
        .mockResolvedValueOnce({ rows: [updatedEvent] }); // UPDATE

      const response = await request(app)
        .put(`/api/admin/events/${mockEvent.id}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Event updated successfully',
        data: expect.objectContaining({
          name: 'Updated Event Name',
          description: 'Updated description'
        })
      });
    });

    it('should return 404 for non-existent event', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .put('/api/admin/events/non-existent-id')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Event not found'
      });
    });
  });

  describe('DELETE /api/admin/events/:id', () => {
    it('should delete event successfully', async () => {
      const existingEvent = {
        id: mockEvent.id,
        created_by: mockUser.id
      };

      pool.query
        .mockResolvedValueOnce({ rows: [existingEvent] }) // SELECT existing
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      const response = await request(app)
        .delete(`/api/admin/events/${mockEvent.id}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Event deleted successfully'
      });

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM events WHERE id = $1',
        [mockEvent.id]
      );
    });

    it('should return 404 for non-existent event', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .delete('/api/admin/events/non-existent-id')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Event not found'
      });
    });
  });

  describe('Authorization', () => {
    it('should require authentication for all routes', async () => {
      // Mock authentication middleware to reject
      const { authenticateToken } = require('../../middleware/auth');
      authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, message: 'Unauthorized' });
      });

      await request(app)
        .get('/api/admin/events')
        .expect(401);

      await request(app)
        .post('/api/admin/events')
        .send(mockEvent)
        .expect(401);

      await request(app)
        .put(`/api/admin/events/${mockEvent.id}`)
        .send({ name: 'Updated' })
        .expect(401);

      await request(app)
        .delete(`/api/admin/events/${mockEvent.id}`)
        .expect(401);
    });

    it('should restrict access for non-admin users', async () => {
      const nonAdminUser = { ...mockUser, role: 'user' };
      
      // Mock authentication middleware for non-admin user
      const { authenticateToken } = require('../../middleware/auth');
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = nonAdminUser;
        next();
      });

      // Mock event owned by different user
      const otherUserEvent = {
        id: mockEvent.id,
        created_by: 'different-user-id'
      };

      pool.query.mockResolvedValue({ rows: [otherUserEvent] });

      const response = await request(app)
        .get(`/api/admin/events/${mockEvent.id}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        message: 'Unauthorized to access this event'
      });
    });
  });
});