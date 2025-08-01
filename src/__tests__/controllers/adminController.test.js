const {
  getCheckins,
  getAnalytics,
  exportCheckins
} = require('../../controllers/adminController');

// Mock dependencies
jest.mock('../../config/database');

const { pool } = require('../../config/database');

describe('Admin Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: {
        id: 'admin-user-id',
        role: 'admin'
      }
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getCheckins', () => {
    it('should get checkins successfully with default parameters', async () => {
      mockReq.params.eventId = 'test-event-id';

      // Mock event query
      pool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'test-event-id',
            name: 'Test Event',
            description: 'Test Description',
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T18:00:00Z',
            is_active: true,
            created_by: 'admin-user-id'
          }]
        })
        // Mock count query
        .mockResolvedValueOnce({
          rows: [{ total: '5' }]
        })
        // Mock data query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'checkin-1',
              event_id: 'test-event-id',
              user_data: { name: 'John Doe', email: 'john@example.com', idNumber: '123' },
              location: { latitude: 40.7128, longitude: -74.0060 },
              qr_token: 'token-1',
              checkin_time: '2024-01-01T12:00:00Z',
              ip_address: '192.168.1.1',
              user_agent: 'Mozilla/5.0',
              validation_status: 'success',
              validation_errors: null,
              created_at: '2024-01-01T12:00:00Z'
            }
          ]
        });

      await getCheckins(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          checkins: expect.arrayContaining([
            expect.objectContaining({
              id: 'checkin-1',
              eventId: 'test-event-id',
              userData: { name: 'John Doe', email: 'john@example.com', idNumber: '123' },
              validationStatus: 'success'
            })
          ]),
          event: expect.objectContaining({
            id: 'test-event-id',
            name: 'Test Event'
          })
        },
        pagination: expect.objectContaining({
          currentPage: 1,
          totalRecords: 5,
          limit: 20
        }),
        filters: expect.any(Object)
      });
    });

    it('should return 404 for non-existent event', async () => {
      mockReq.params.eventId = 'non-existent-event';

      pool.query.mockResolvedValueOnce({ rows: [] });

      await getCheckins(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event not found'
      });
    });

    it('should return 403 for unauthorized user', async () => {
      mockReq.params.eventId = 'test-event-id';
      mockReq.user = { id: 'other-user-id', role: 'user' };

      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 'test-event-id',
          created_by: 'different-user-id'
        }]
      });

      await getCheckins(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized to access this event data'
      });
    });

    it('should handle filtering and pagination parameters', async () => {
      mockReq.params.eventId = 'test-event-id';
      mockReq.query = {
        page: '2',
        limit: '10',
        status: 'success',
        search: 'john',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        sortBy: 'checkin_time',
        sortOrder: 'ASC'
      };

      pool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'test-event-id',
            created_by: 'admin-user-id'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({ rows: [] });

      await getCheckins(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: expect.objectContaining({
            currentPage: 2,
            limit: 10,
            totalRecords: 25
          }),
          filters: expect.objectContaining({
            status: 'success',
            search: 'john',
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            sortBy: 'checkin_time',
            sortOrder: 'ASC'
          })
        })
      );
    });

    it('should handle database errors', async () => {
      mockReq.params.eventId = 'test-event-id';

      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await getCheckins(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: 'Database error'
      });
    });
  });

  describe('getAnalytics', () => {
    it('should get analytics successfully', async () => {
      mockReq.params.eventId = 'test-event-id';
      mockReq.query.timeRange = '24h';

      pool.query
        // Mock event query
        .mockResolvedValueOnce({
          rows: [{
            id: 'test-event-id',
            created_by: 'admin-user-id'
          }]
        })
        // Mock stats query
        .mockResolvedValueOnce({
          rows: [{
            total_checkins: '100',
            successful_checkins: '95',
            failed_checkins: '5',
            first_checkin: '2024-01-01T10:00:00Z',
            last_checkin: '2024-01-01T17:00:00Z'
          }]
        })
        // Mock hourly query
        .mockResolvedValueOnce({
          rows: [
            { hour: '2024-01-01T10:00:00Z', checkins: '10', successful: '9' },
            { hour: '2024-01-01T11:00:00Z', checkins: '15', successful: '14' }
          ]
        })
        // Mock location query
        .mockResolvedValueOnce({
          rows: [
            { lat: '40.7128', lng: '-74.0060', count: '50' },
            { lat: '40.7589', lng: '-73.9851', count: '30' }
          ]
        })
        // Mock errors query
        .mockResolvedValueOnce({
          rows: [
            { validation_errors: { code: 'OUTSIDE_GEOFENCE' }, count: '3' },
            { validation_errors: { code: 'QR_EXPIRED' }, count: '2' }
          ]
        });

      await getAnalytics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          eventId: 'test-event-id',
          timeRange: '24h',
          summary: expect.objectContaining({
            totalCheckins: 100,
            successfulCheckins: 95,
            failedCheckins: 5,
            successRate: '95.00'
          }),
          hourlyBreakdown: expect.arrayContaining([
            expect.objectContaining({
              hour: '2024-01-01T10:00:00Z',
              checkins: 10,
              successful: 9
            })
          ]),
          locationHeatmap: expect.arrayContaining([
            expect.objectContaining({
              lat: 40.7128,
              lng: -74.0060,
              count: 50
            })
          ]),
          topErrors: expect.arrayContaining([
            expect.objectContaining({
              error: { code: 'OUTSIDE_GEOFENCE' },
              count: 3
            })
          ])
        })
      });
    });

    it('should return 404 for non-existent event', async () => {
      mockReq.params.eventId = 'non-existent-event';

      pool.query.mockResolvedValueOnce({ rows: [] });

      await getAnalytics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event not found'
      });
    });

    it('should handle database errors', async () => {
      mockReq.params.eventId = 'test-event-id';

      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await getAnalytics(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: 'Database error'
      });
    });
  });

  describe('exportCheckins', () => {
    it('should export checkins as CSV successfully', async () => {
      mockReq.params.eventId = 'test-event-id';
      mockReq.body = {
        format: 'csv',
        status: 'all',
        includeLocation: true,
        includeUserAgent: false
      };

      pool.query
        // Mock event query
        .mockResolvedValueOnce({
          rows: [{
            id: 'test-event-id',
            name: 'Test Event',
            created_by: 'admin-user-id'
          }]
        })
        // Mock export query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'checkin-1',
              user_data: { name: 'John Doe', email: 'john@example.com', idNumber: '123' },
              location: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
              qr_token: 'token-1',
              checkin_time: new Date('2024-01-01T12:00:00Z'),
              ip_address: '192.168.1.1',
              user_agent: 'Mozilla/5.0',
              validation_status: 'success',
              validation_errors: null
            }
          ]
        });

      await exportCheckins(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition', 
        expect.stringContaining('attachment; filename="checkins_Test_Event_')
      );
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('ID,Name,Email,ID Number,Check-in Time,Status')
      );
    });

    it('should return 404 when no data found', async () => {
      mockReq.params.eventId = 'test-event-id';
      mockReq.body = {};

      pool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'test-event-id',
            name: 'Test Event',
            created_by: 'admin-user-id'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await exportCheckins(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'No check-in data found for the specified criteria'
      });
    });
  });
});
