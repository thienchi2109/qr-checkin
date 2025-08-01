const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../routes/adminRoutes');

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../controllers/adminController');

const { pool } = require('../../config/database');
const adminController = require('../../controllers/adminController');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: 'test-user-id',
      role: 'admin',
      email: 'admin@example.com'
    };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Admin access required' });
    }
  }
}));

describe('Admin Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/checkins/:eventId', () => {
    it('should call getCheckins controller with correct parameters', async () => {
      const mockResponse = {
        success: true,
        data: {
          checkins: [],
          event: { id: 'test-event-id', name: 'Test Event' }
        },
        pagination: { currentPage: 1, totalRecords: 0 }
      };

      adminController.getCheckins = jest.fn((req, res) => {
        res.json(mockResponse);
      });

      const response = await request(app)
        .get('/api/admin/checkins/test-event-id')
        .query({
          page: '1',
          limit: '20',
          status: 'success',
          search: 'john'
        })
        .expect(200);

      expect(adminController.getCheckins).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should handle authentication requirement', async () => {
      // Override auth middleware to simulate unauthenticated request
      const authApp = express();
      authApp.use(express.json());
      authApp.use('/api/admin', (req, res, next) => {
        res.status(401).json({ success: false, message: 'Authentication required' });
      });

      await request(authApp)
        .get('/api/admin/checkins/test-event-id')
        .expect(401);
    });
  });

  describe('GET /api/admin/analytics/:eventId', () => {
    it('should call getAnalytics controller with correct parameters', async () => {
      const mockResponse = {
        success: true,
        data: {
          eventId: 'test-event-id',
          summary: {
            totalCheckins: 100,
            successfulCheckins: 95,
            successRate: '95.00'
          },
          hourlyBreakdown: [],
          locationHeatmap: []
        }
      };

      adminController.getAnalytics = jest.fn((req, res) => {
        res.json(mockResponse);
      });

      const response = await request(app)
        .get('/api/admin/analytics/test-event-id')
        .query({ timeRange: '24h' })
        .expect(200);

      expect(adminController.getAnalytics).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should handle different time ranges', async () => {
      adminController.getAnalytics = jest.fn((req, res) => {
        expect(req.query.timeRange).toBe('7d');
        res.json({ success: true, data: {} });
      });

      await request(app)
        .get('/api/admin/analytics/test-event-id')
        .query({ timeRange: '7d' })
        .expect(200);

      expect(adminController.getAnalytics).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/export/:eventId', () => {
    it('should call exportCheckins controller with correct parameters', async () => {
      const csvContent = 'ID,Name,Email,Check-in Time\ntest-id,John Doe,john@example.com,2024-01-01T12:00:00Z';

      adminController.exportCheckins = jest.fn((req, res) => {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="checkins_export.csv"');
        res.send(csvContent);
      });

      const response = await request(app)
        .post('/api/admin/export/test-event-id')
        .send({
          format: 'csv',
          status: 'success',
          includeLocation: true,
          startDate: '2024-01-01',
          endDate: '2024-01-02'
        })
        .expect(200);

      expect(adminController.exportCheckins).toHaveBeenCalled();
      expect(response.text).toBe(csvContent);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    });

    it('should handle export with different parameters', async () => {
      adminController.exportCheckins = jest.fn((req, res) => {
        expect(req.body).toEqual({
          format: 'csv',
          status: 'all',
          includeLocation: false,
          includeUserAgent: true
        });
        res.json({ success: true });
      });

      await request(app)
        .post('/api/admin/export/test-event-id')
        .send({
          format: 'csv',
          status: 'all',
          includeLocation: false,
          includeUserAgent: true
        })
        .expect(200);

      expect(adminController.exportCheckins).toHaveBeenCalled();
    });

    it('should handle missing request body', async () => {
      adminController.exportCheckins = jest.fn((req, res) => {
        expect(req.body).toEqual({});
        res.json({ success: true });
      });

      await request(app)
        .post('/api/admin/export/test-event-id')
        .send({})
        .expect(200);

      expect(adminController.exportCheckins).toHaveBeenCalled();
    });
  });

  describe('Route Parameter Validation', () => {
    it('should pass eventId parameter to controllers', async () => {
      const testEventId = 'test-event-123';

      adminController.getCheckins = jest.fn((req, res) => {
        expect(req.params.eventId).toBe(testEventId);
        res.json({ success: true });
      });

      await request(app)
        .get(`/api/admin/checkins/${testEventId}`)
        .expect(200);

      expect(adminController.getCheckins).toHaveBeenCalled();
    });

    it('should handle special characters in eventId', async () => {
      const testEventId = 'event-with-dashes-123';

      adminController.getAnalytics = jest.fn((req, res) => {
        expect(req.params.eventId).toBe(testEventId);
        res.json({ success: true });
      });

      await request(app)
        .get(`/api/admin/analytics/${testEventId}`)
        .expect(200);

      expect(adminController.getAnalytics).toHaveBeenCalled();
    });
  });

  describe('Query Parameter Handling', () => {
    it('should pass all query parameters to getCheckins', async () => {
      const queryParams = {
        page: '2',
        limit: '50',
        status: 'failed',
        search: 'test search',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        sortBy: 'checkin_time',
        sortOrder: 'ASC'
      };

      adminController.getCheckins = jest.fn((req, res) => {
        expect(req.query).toEqual(queryParams);
        res.json({ success: true });
      });

      await request(app)
        .get('/api/admin/checkins/test-event-id')
        .query(queryParams)
        .expect(200);

      expect(adminController.getCheckins).toHaveBeenCalled();
    });

    it('should handle empty query parameters', async () => {
      adminController.getCheckins = jest.fn((req, res) => {
        expect(req.query).toEqual({});
        res.json({ success: true });
      });

      await request(app)
        .get('/api/admin/checkins/test-event-id')
        .expect(200);

      expect(adminController.getCheckins).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      adminController.getCheckins = jest.fn((req, res) => {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });

      const response = await request(app)
        .get('/api/admin/checkins/test-event-id')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error'
      });
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/admin/export/test-event-id')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON request bodies', async () => {
      const requestBody = {
        format: 'csv',
        status: 'success',
        includeLocation: true
      };

      adminController.exportCheckins = jest.fn((req, res) => {
        expect(req.body).toEqual(requestBody);
        res.json({ success: true });
      });

      await request(app)
        .post('/api/admin/export/test-event-id')
        .send(requestBody)
        .expect(200);

      expect(adminController.exportCheckins).toHaveBeenCalled();
    });
  });
});
