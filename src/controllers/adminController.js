const { pool } = require('../config/database');
const { randomUUID } = require('crypto');

/**
 * Admin Controller for monitoring and analytics
 * Handles check-in monitoring, analytics, and export functionality
 * Requirements: 4.1, 4.2, 4.4
 */

/**
 * Get check-ins for a specific event with real-time data
 * GET /api/admin/checkins/:eventId
 */
const getCheckins = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      page = 1,
      limit = 20,
      status = 'all',
      startDate,
      endDate,
      search,
      sortBy = 'checkin_time',
      sortOrder = 'DESC'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const allowedSortFields = ['checkin_time', 'validation_status', 'user_data', 'location'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'checkin_time';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // First, verify event exists and user has access
    const eventQuery = 'SELECT * FROM events WHERE id = $1';
    const eventResult = await pool.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const event = eventResult.rows[0];

    // Check if user owns this event or is admin
    if (event.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this event data'
      });
    }

    // Build WHERE clause for checkins
    let whereConditions = ['event_id = $1'];
    let queryParams = [eventId];
    let paramIndex = 2;

    // Status filter
    if (status !== 'all') {
      whereConditions.push(`validation_status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Date range filters
    if (startDate) {
      whereConditions.push(`checkin_time >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`checkin_time <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    // Search filter (search in user data)
    if (search) {
      whereConditions.push(`(
        user_data->>'name' ILIKE $${paramIndex} OR 
        user_data->>'email' ILIKE $${paramIndex} OR 
        user_data->>'idNumber' ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM checkins ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataQuery = `
      SELECT 
        id, event_id, user_data, location, qr_token,
        checkin_time, ip_address, user_agent, validation_status,
        validation_errors, created_at
      FROM checkins 
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);
    const dataResult = await pool.query(dataQuery, queryParams);

    // Format response data
    const checkins = dataResult.rows.map(checkin => ({
      id: checkin.id,
      eventId: checkin.event_id,
      userData: checkin.user_data,
      location: checkin.location,
      qrToken: checkin.qr_token,
      checkinTime: checkin.checkin_time,
      ipAddress: checkin.ip_address,
      userAgent: checkin.user_agent,
      validationStatus: checkin.validation_status,
      validationErrors: checkin.validation_errors,
      createdAt: checkin.created_at
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalRecords / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: {
        checkins,
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          startTime: event.start_time,
          endTime: event.end_time,
          isActive: event.is_active
        }
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        status,
        startDate,
        endDate,
        search,
        sortBy: sortField,
        sortOrder: sortDirection
      }
    });

  } catch (error) {
    console.error('Error getting checkins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get analytics and statistics for an event
 * GET /api/admin/analytics/:eventId
 */
const getAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { timeRange = '24h' } = req.query;

    // First, verify event exists and user has access
    const eventQuery = 'SELECT * FROM events WHERE id = $1';
    const eventResult = await pool.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const event = eventResult.rows[0];

    // Check if user owns this event or is admin
    if (event.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this event analytics'
      });
    }

    // Calculate time range for analytics
    let timeFilter = '';
    let timeParams = [eventId];
    
    if (timeRange === '1h') {
      timeFilter = "AND checkin_time >= NOW() - INTERVAL '1 hour'";
    } else if (timeRange === '24h') {
      timeFilter = "AND checkin_time >= NOW() - INTERVAL '24 hours'";
    } else if (timeRange === '7d') {
      timeFilter = "AND checkin_time >= NOW() - INTERVAL '7 days'";
    } else if (timeRange === '30d') {
      timeFilter = "AND checkin_time >= NOW() - INTERVAL '30 days'";
    }

    // Get basic statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_checkins,
        COUNT(CASE WHEN validation_status = 'success' THEN 1 END) as successful_checkins,
        COUNT(CASE WHEN validation_status = 'failed' THEN 1 END) as failed_checkins,
        MIN(checkin_time) as first_checkin,
        MAX(checkin_time) as last_checkin
      FROM checkins 
      WHERE event_id = $1 ${timeFilter}
    `;

    const statsResult = await pool.query(statsQuery, timeParams);
    const stats = statsResult.rows[0];

    // Get hourly breakdown for the last 24 hours
    const hourlyQuery = `
      SELECT 
        DATE_TRUNC('hour', checkin_time) as hour,
        COUNT(*) as checkins,
        COUNT(CASE WHEN validation_status = 'success' THEN 1 END) as successful
      FROM checkins 
      WHERE event_id = $1 AND checkin_time >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', checkin_time)
      ORDER BY hour
    `;

    const hourlyResult = await pool.query(hourlyQuery, [eventId]);

    // Get location heatmap data (successful checkins only)
    const locationQuery = `
      SELECT 
        location->>'latitude' as lat,
        location->>'longitude' as lng,
        COUNT(*) as count
      FROM checkins 
      WHERE event_id = $1 
        AND validation_status = 'success' 
        AND location IS NOT NULL
        ${timeFilter}
      GROUP BY location->>'latitude', location->>'longitude'
      ORDER BY count DESC
      LIMIT 100
    `;

    const locationResult = await pool.query(locationQuery, timeParams);

    // Get top validation errors
    const errorsQuery = `
      SELECT 
        validation_errors,
        COUNT(*) as count
      FROM checkins 
      WHERE event_id = $1 
        AND validation_status = 'failed' 
        AND validation_errors IS NOT NULL
        ${timeFilter}
      GROUP BY validation_errors
      ORDER BY count DESC
      LIMIT 10
    `;

    const errorsResult = await pool.query(errorsQuery, timeParams);

    res.json({
      success: true,
      data: {
        eventId,
        timeRange,
        summary: {
          totalCheckins: parseInt(stats.total_checkins),
          successfulCheckins: parseInt(stats.successful_checkins),
          failedCheckins: parseInt(stats.failed_checkins),
          successRate: stats.total_checkins > 0 ? 
            (stats.successful_checkins / stats.total_checkins * 100).toFixed(2) : 0,
          firstCheckin: stats.first_checkin,
          lastCheckin: stats.last_checkin
        },
        hourlyBreakdown: hourlyResult.rows.map(row => ({
          hour: row.hour,
          checkins: parseInt(row.checkins),
          successful: parseInt(row.successful)
        })),
        locationHeatmap: locationResult.rows.map(row => ({
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
          count: parseInt(row.count)
        })),
        topErrors: errorsResult.rows.map(row => ({
          error: row.validation_errors,
          count: parseInt(row.count)
        })),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Export check-in data as CSV/Excel
 * POST /api/admin/export/:eventId
 */
const exportCheckins = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      format = 'csv',
      status = 'all',
      startDate,
      endDate,
      includeLocation = true,
      includeUserAgent = false
    } = req.body;

    // First, verify event exists and user has access
    const eventQuery = 'SELECT * FROM events WHERE id = $1';
    const eventResult = await pool.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const event = eventResult.rows[0];

    // Check if user owns this event or is admin
    if (event.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to export this event data'
      });
    }

    // Build WHERE clause for export
    let whereConditions = ['event_id = $1'];
    let queryParams = [eventId];
    let paramIndex = 2;

    // Status filter
    if (status !== 'all') {
      whereConditions.push(`validation_status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Date range filters
    if (startDate) {
      whereConditions.push(`checkin_time >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`checkin_time <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get all matching records for export
    const exportQuery = `
      SELECT
        id, user_data, location, qr_token, checkin_time,
        ip_address, user_agent, validation_status, validation_errors
      FROM checkins
      ${whereClause}
      ORDER BY checkin_time DESC
    `;

    const exportResult = await pool.query(exportQuery, queryParams);
    const checkins = exportResult.rows;

    if (checkins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No check-in data found for the specified criteria'
      });
    }

    // Generate CSV content
    const csvHeaders = [
      'ID',
      'Name',
      'Email',
      'ID Number',
      'Check-in Time',
      'Status'
    ];

    if (includeLocation) {
      csvHeaders.push('Latitude', 'Longitude', 'Location Accuracy');
    }

    csvHeaders.push('IP Address');

    if (includeUserAgent) {
      csvHeaders.push('User Agent');
    }

    csvHeaders.push('QR Token', 'Validation Errors');

    // Build CSV rows
    const csvRows = [csvHeaders.join(',')];

    checkins.forEach(checkin => {
      const row = [
        checkin.id,
        `"${checkin.user_data.name || ''}"`,
        `"${checkin.user_data.email || ''}"`,
        `"${checkin.user_data.idNumber || ''}"`,
        checkin.checkin_time.toISOString(),
        checkin.validation_status
      ];

      if (includeLocation && checkin.location) {
        row.push(
          checkin.location.latitude || '',
          checkin.location.longitude || '',
          checkin.location.accuracy || ''
        );
      } else if (includeLocation) {
        row.push('', '', '');
      }

      row.push(checkin.ip_address || '');

      if (includeUserAgent) {
        row.push(`"${checkin.user_agent || ''}"`);
      }

      row.push(
        `"${checkin.qr_token || ''}"`,
        `"${checkin.validation_errors ? JSON.stringify(checkin.validation_errors) : ''}"`
      );

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `checkins_${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent));

    // Send CSV content
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting checkins:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getCheckins,
  getAnalytics,
  exportCheckins
};
