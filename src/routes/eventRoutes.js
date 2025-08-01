const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  createEvent,
  updateEvent,
  getEvents,
  getEventById,
  deleteEvent
} = require('../controllers/eventController');

/**
 * Event Routes
 * All routes require authentication
 * Requirements: 1.1, 1.5
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/admin/events
 * @desc    Get events with filtering and pagination
 * @access  Private (Admin/Event Owner)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10, max: 100)
 * @query   {string} search - Search in name and description
 * @query   {boolean} isActive - Filter by active status
 * @query   {string} startDate - Filter events starting after this date
 * @query   {string} endDate - Filter events ending before this date
 * @query   {string} sortBy - Sort field (name, start_time, end_time, created_at, updated_at)
 * @query   {string} sortOrder - Sort order (ASC, DESC)
 */
router.get('/', getEvents);

/**
 * @route   GET /api/admin/events/:id
 * @desc    Get a single event by ID
 * @access  Private (Admin/Event Owner)
 */
router.get('/:id', getEventById);

/**
 * @route   POST /api/admin/events
 * @desc    Create a new event
 * @access  Private (Admin)
 * @body    {object} Event data
 */
router.post('/', createEvent);

/**
 * @route   PUT /api/admin/events/:id
 * @desc    Update an existing event
 * @access  Private (Admin/Event Owner)
 * @body    {object} Updated event data
 */
router.put('/:id', updateEvent);

/**
 * @route   DELETE /api/admin/events/:id
 * @desc    Delete an event
 * @access  Private (Admin/Event Owner)
 */
router.delete('/:id', deleteEvent);

module.exports = router;