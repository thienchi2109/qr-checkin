const { pool } = require('../../config/database');
const Event = require('../../models/Event');
const {
  createEvent,
  updateEvent,
  getEvents,
  getEventById,
  deleteEvent
} = require('../../controllers/eventController');

// Mock dependencies
jest.mock('../../config/database');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-event-id')
}));

describe('Event Controller', () => {
  let mockReq;
  let mockRes;
  let mockUser;
  let mockEvent;

  beforeEach(() => {
    // Mock user
    mockUser = {
      id: 'test-user-id',
      role: 'admin'
    };

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
      createdBy: 'test-user-id'
    };

    // Mock request and response
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: mockUser
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock database pool
    pool.query = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    beforeEach(() => {
      mockReq.body = { ...mockEvent };
      delete mockReq.body.id;
      delete mockReq.body.createdBy;
    });

    it('should create event successfully with valid data', async () => {
      const mockDbResult = {
        rows: [{
          id: 'test-event-id',
          name: mockEvent.name,
          description: mockEvent.description,
          start_time: mockEvent.startTime,
          end_time: mockEvent.endTime,
          geofence: mockEvent.geofence,
          qr_settings: mockEvent.qrSettings,
          is_active: mockEvent.isActive,
          created_by: mockUser.id,
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      pool.query.mockResolvedValue(mockDbResult);

      await createEvent(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'test-event-id',
          mockEvent.name,
          mockEvent.description,
          mockEvent.startTime,
          mockEvent.endTime,
          JSON.stringify(mockEvent.geofence),
          JSON.stringify(mockEvent.qrSettings),
          mockEvent.isActive,
          mockUser.id
        ])
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Event created successfully',
        data: expect.objectContaining({
          id: 'test-event-id',
          name: mockEvent.name
        })
      });
    });

    it('should return 400 for invalid event data', async () => {
      mockReq.body = {
        name: '', // Invalid: empty name
        startTime: mockEvent.startTime,
        endTime: mockEvent.endTime
      };

      await createEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('Name is required')
        ])
      });
    });

    it('should return 400 for missing required fields', async () => {
      mockReq.body = {
        name: 'Test Event'
        // Missing startTime, endTime, geofence
      };

      await createEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('Start time is required'),
          expect.stringContaining('End time is required'),
          expect.stringContaining('Geofence configuration is required')
        ])
      });
    });

    it('should return 400 for invalid geofence data', async () => {
      mockReq.body = {
        ...mockEvent,
        geofence: {
          type: 'circle',
          coordinates: { lat: 'invalid', lng: -74.0060 },
          radius: 100
        }
      };
      delete mockReq.body.id;
      delete mockReq.body.createdBy;

      await createEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('latitude must be a number')
        ])
      });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      await createEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? 'Database error' : undefined
      });
    });
  });

  describe('updateEvent', () => {
    beforeEach(() => {
      mockReq.params = { id: 'test-event-id' };
      mockReq.body = {
        name: 'Updated Event Name',
        description: 'Updated description'
      };
    });

    it('should update event successfully', async () => {
      const existingEvent = {
        id: 'test-event-id',
        name: 'Original Event',
        description: 'Original description',
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: true,
        created_by: mockUser.id,
        created_at: new Date(),
        updated_at: new Date()
      };

      const updatedEvent = {
        ...existingEvent,
        name: 'Updated Event Name',
        description: 'Updated description',
        updated_at: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [existingEvent] }) // SELECT existing
        .mockResolvedValueOnce({ rows: [updatedEvent] }); // UPDATE

      await updateEvent(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM events WHERE id = $1',
        ['test-event-id']
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE events SET'),
        expect.arrayContaining(['Updated Event Name', 'Updated description'])
      );

      expect(mockRes.json).toHaveBeenCalledWith({
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

      await updateEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event not found'
      });
    });

    it('should return 403 for unauthorized user', async () => {
      const existingEvent = {
        id: 'test-event-id',
        created_by: 'different-user-id'
      };

      mockReq.user = { id: 'test-user-id', role: 'user' }; // Not admin, not owner

      pool.query.mockResolvedValue({ rows: [existingEvent] });

      await updateEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized to update this event'
      });
    });

    it('should return 400 for invalid update data', async () => {
      const existingEvent = {
        id: 'test-event-id',
        name: 'Original Event',
        description: 'Original description',
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: true,
        created_by: mockUser.id
      };

      mockReq.body = {
        name: '', // Invalid: empty name
        startTime: '2024-12-01T18:00:00Z', // Invalid: after end time
        endTime: '2024-12-01T10:00:00Z'
      };

      pool.query.mockResolvedValue({ rows: [existingEvent] });

      await updateEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.stringContaining('Name is required'),
          expect.stringContaining('End time must be after start time')
        ])
      });
    });
  });

  describe('getEvents', () => {
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
        },
        {
          id: 'event-2',
          name: 'Event 2',
          description: 'Description 2',
          start_time: '2024-12-02T10:00:00Z',
          end_time: '2024-12-02T18:00:00Z',
          geofence: mockEvent.geofence,
          qr_settings: mockEvent.qrSettings,
          is_active: false,
          created_by: mockUser.id,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // COUNT query
        .mockResolvedValueOnce({ rows: mockEvents }); // SELECT query

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'event-1', name: 'Event 1' }),
          expect.objectContaining({ id: 'event-2', name: 'Event 2' })
        ]),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalRecords: 2,
          limit: 10,
          hasNextPage: false,
          hasPrevPage: false
        },
        filters: {
          search: undefined,
          isActive: undefined,
          startDate: undefined,
          endDate: undefined,
          sortBy: 'created_at',
          sortOrder: 'DESC'
        }
      });
    });

    it('should filter events by search term', async () => {
      mockReq.query = { search: 'Test Event' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $'),
        expect.arrayContaining(['%Test Event%'])
      );
    });

    it('should filter events by active status', async () => {
      mockReq.query = { isActive: 'true' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = $'),
        expect.arrayContaining([true])
      );
    });

    it('should filter events by date range', async () => {
      mockReq.query = {
        startDate: '2024-12-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('start_time >= $'),
        expect.arrayContaining(['2024-12-01T00:00:00Z', '2024-12-31T23:59:59Z'])
      );
    });

    it('should handle pagination parameters', async () => {
      mockReq.query = { page: '2', limit: '5' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '15' }] })
        .mockResolvedValueOnce({ rows: [] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([5, 5]) // limit, offset
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            currentPage: 2,
            totalPages: 3,
            totalRecords: 15,
            limit: 5,
            hasNextPage: true,
            hasPrevPage: true
          })
        })
      );
    });

    it('should handle sorting parameters', async () => {
      mockReq.query = { sortBy: 'name', sortOrder: 'ASC' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name ASC'),
        expect.any(Array)
      );
    });

    it('should restrict events for non-admin users', async () => {
      mockReq.user = { id: 'test-user-id', role: 'user' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockEvent] });

      await getEvents(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_by = $'),
        expect.arrayContaining(['test-user-id'])
      );
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      await getEvents(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? 'Database error' : undefined
      });
    });
  });

  describe('getEventById', () => {
    beforeEach(() => {
      mockReq.params = { id: 'test-event-id' };
    });

    it('should get event by ID successfully', async () => {
      const dbEvent = {
        id: 'test-event-id',
        name: mockEvent.name,
        description: mockEvent.description,
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: mockEvent.isActive,
        created_by: mockUser.id,
        created_at: new Date(),
        updated_at: new Date()
      };

      pool.query.mockResolvedValue({ rows: [dbEvent] });

      await getEventById(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM events WHERE id = $1',
        ['test-event-id']
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-event-id',
          name: mockEvent.name
        })
      });
    });

    it('should return 404 for non-existent event', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await getEventById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event not found'
      });
    });

    it('should return 403 for unauthorized user', async () => {
      const dbEvent = {
        id: 'test-event-id',
        created_by: 'different-user-id'
      };

      mockReq.user = { id: 'test-user-id', role: 'user' };

      pool.query.mockResolvedValue({ rows: [dbEvent] });

      await getEventById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized to access this event'
      });
    });

    it('should allow admin to access any event', async () => {
      const dbEvent = {
        id: 'test-event-id',
        name: mockEvent.name,
        created_by: 'different-user-id',
        geofence: mockEvent.geofence,
        qr_settings: mockEvent.qrSettings,
        is_active: mockEvent.isActive,
        start_time: mockEvent.startTime,
        end_time: mockEvent.endTime,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockReq.user = { id: 'admin-user-id', role: 'admin' };

      pool.query.mockResolvedValue({ rows: [dbEvent] });

      await getEventById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-event-id',
          name: mockEvent.name
        })
      });
    });
  });

  describe('deleteEvent', () => {
    beforeEach(() => {
      mockReq.params = { id: 'test-event-id' };
    });

    it('should delete event successfully', async () => {
      const existingEvent = {
        id: 'test-event-id',
        created_by: mockUser.id
      };

      pool.query
        .mockResolvedValueOnce({ rows: [existingEvent] }) // SELECT existing
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      await deleteEvent(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM events WHERE id = $1',
        ['test-event-id']
      );

      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM events WHERE id = $1',
        ['test-event-id']
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Event deleted successfully'
      });
    });

    it('should return 404 for non-existent event', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await deleteEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event not found'
      });
    });

    it('should return 403 for unauthorized user', async () => {
      const existingEvent = {
        id: 'test-event-id',
        created_by: 'different-user-id'
      };

      mockReq.user = { id: 'test-user-id', role: 'user' };

      pool.query.mockResolvedValue({ rows: [existingEvent] });

      await deleteEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized to delete this event'
      });
    });

    it('should allow admin to delete any event', async () => {
      const existingEvent = {
        id: 'test-event-id',
        created_by: 'different-user-id'
      };

      mockReq.user = { id: 'admin-user-id', role: 'admin' };

      pool.query
        .mockResolvedValueOnce({ rows: [existingEvent] })
        .mockResolvedValueOnce({ rows: [] });

      await deleteEvent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Event deleted successfully'
      });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      await deleteEvent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? 'Database error' : undefined
      });
    });
  });
});