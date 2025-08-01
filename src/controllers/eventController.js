const { pool } = require('../config/database');
const Event = require('../models/Event');
const { randomUUID } = require('crypto');

/**
 * Event Controller
 * Handles CRUD operations for events
 * Requirements: 1.1, 1.5
 */

/**
 * Create a new event
 * POST /api/admin/events
 */
const createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user.id // From auth middleware
    };

    // Create and validate event model
    const event = new Event(eventData);
    const validation = event.validate();

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Generate UUID for the event
    const eventId = randomUUID();

    // Insert event into database
    const query = `
      INSERT INTO events (
        id, name, description, start_time, end_time, 
        geofence, qr_settings, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      eventId,
      event.name,
      event.description,
      event.startTime,
      event.endTime,
      JSON.stringify(event.geofence),
      JSON.stringify(event.qrSettings),
      event.isActive,
      event.createdBy
    ];

    const result = await pool.query(query, values);
    const createdEvent = result.rows[0];

    // Convert database format back to model format
    const responseEvent = {
      ...createdEvent,
      geofence: createdEvent.geofence,
      qrSettings: createdEvent.qr_settings,
      isActive: createdEvent.is_active,
      createdBy: createdEvent.created_by,
      createdAt: createdEvent.created_at,
      updatedAt: createdEvent.updated_at
    };

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: responseEvent
    });

  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update an existing event
 * PUT /api/admin/events/:id
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // First, get the existing event
    const existingQuery = 'SELECT * FROM events WHERE id = $1';
    const existingResult = await pool.query(existingQuery, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const existingEvent = existingResult.rows[0];

    // Check if user owns this event or is admin
    if (existingEvent.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this event'
      });
    }

    // Merge existing data with updates
    const eventData = {
      id: existingEvent.id,
      name: updateData.name || existingEvent.name,
      description: updateData.description !== undefined ? updateData.description : existingEvent.description,
      startTime: updateData.startTime || existingEvent.start_time,
      endTime: updateData.endTime || existingEvent.end_time,
      geofence: updateData.geofence || existingEvent.geofence,
      qrSettings: updateData.qrSettings || existingEvent.qr_settings,
      isActive: updateData.isActive !== undefined ? updateData.isActive : existingEvent.is_active,
      createdBy: existingEvent.created_by,
      createdAt: existingEvent.created_at,
      updatedAt: new Date()
    };

    // Validate updated event
    const event = new Event(eventData);
    const validation = event.validate();

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Update event in database
    const updateQuery = `
      UPDATE events SET 
        name = $1, 
        description = $2, 
        start_time = $3, 
        end_time = $4,
        geofence = $5, 
        qr_settings = $6, 
        is_active = $7, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const updateValues = [
      event.name,
      event.description,
      event.startTime,
      event.endTime,
      JSON.stringify(event.geofence),
      JSON.stringify(event.qrSettings),
      event.isActive,
      id
    ];

    const result = await pool.query(updateQuery, updateValues);
    const updatedEvent = result.rows[0];

    // Convert database format back to model format
    const responseEvent = {
      ...updatedEvent,
      geofence: updatedEvent.geofence,
      qrSettings: updatedEvent.qr_settings,
      isActive: updatedEvent.is_active,
      createdBy: updatedEvent.created_by,
      createdAt: updatedEvent.created_at,
      updatedAt: updatedEvent.updated_at
    };

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: responseEvent
    });

  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get events with filtering and pagination
 * GET /api/admin/events
 */
const getEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const allowedSortFields = ['name', 'start_time', 'end_time', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Build WHERE clause
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Filter by user's events (unless admin)
    if (req.user.role !== 'admin') {
      whereConditions.push(`created_by = $${paramIndex}`);
      queryParams.push(req.user.id);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Active status filter
    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
      paramIndex++;
    }

    // Date range filters
    if (startDate) {
      whereConditions.push(`start_time >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`end_time <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM events ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataQuery = `
      SELECT 
        id, name, description, start_time, end_time, 
        geofence, qr_settings, is_active, created_by, 
        created_at, updated_at
      FROM events 
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);
    const dataResult = await pool.query(dataQuery, queryParams);

    // Format response data
    const events = dataResult.rows.map(event => ({
      ...event,
      geofence: event.geofence,
      qrSettings: event.qr_settings,
      isActive: event.is_active,
      createdBy: event.created_by,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalRecords / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: events,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        isActive,
        startDate,
        endDate,
        sortBy: sortField,
        sortOrder: sortDirection
      }
    });

  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get a single event by ID
 * GET /api/admin/events/:id
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM events WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const event = result.rows[0];

    // Check if user owns this event or is admin
    if (event.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this event'
      });
    }

    // Format response data
    const responseEvent = {
      ...event,
      geofence: event.geofence,
      qrSettings: event.qr_settings,
      isActive: event.is_active,
      createdBy: event.created_by,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };

    res.json({
      success: true,
      data: responseEvent
    });

  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete an event
 * DELETE /api/admin/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the existing event
    const existingQuery = 'SELECT * FROM events WHERE id = $1';
    const existingResult = await pool.query(existingQuery, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const existingEvent = existingResult.rows[0];

    // Check if user owns this event or is admin
    if (existingEvent.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this event'
      });
    }

    // Delete the event (cascade will handle related records)
    const deleteQuery = 'DELETE FROM events WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createEvent,
  updateEvent,
  getEvents,
  getEventById,
  deleteEvent
};