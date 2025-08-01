const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getCheckins,
  getAnalytics,
  exportCheckins
} = require('../controllers/adminController');

/**
 * Admin Routes for monitoring and analytics
 * All routes require authentication
 * Requirements: 4.1, 4.2, 4.4
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/admin/checkins/:eventId
 * @desc    Get check-ins for a specific event with real-time data
 * @access  Private (Admin/Event Owner)
 * @param   {string} eventId - Event ID
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 * @query   {string} status - Filter by status (all, success, failed)
 * @query   {string} startDate - Filter check-ins after this date
 * @query   {string} endDate - Filter check-ins before this date
 * @query   {string} search - Search in user data (name, email, idNumber)
 * @query   {string} sortBy - Sort field (checkin_time, validation_status, user_data, location)
 * @query   {string} sortOrder - Sort order (ASC, DESC)
 */
router.get('/checkins/:eventId', getCheckins);

/**
 * @route   GET /api/admin/analytics/:eventId
 * @desc    Get analytics and statistics for an event
 * @access  Private (Admin/Event Owner)
 * @param   {string} eventId - Event ID
 * @query   {string} timeRange - Time range for analytics (1h, 24h, 7d, 30d)
 */
router.get('/analytics/:eventId', getAnalytics);

/**
 * @route   POST /api/admin/export/:eventId
 * @desc    Export check-in data as CSV/Excel
 * @access  Private (Admin/Event Owner)
 * @param   {string} eventId - Event ID
 * @body    {string} format - Export format (csv, excel) - default: csv
 * @body    {string} status - Filter by status (all, success, failed) - default: all
 * @body    {string} startDate - Filter check-ins after this date
 * @body    {string} endDate - Filter check-ins before this date
 * @body    {boolean} includeLocation - Include location data - default: true
 * @body    {boolean} includeUserAgent - Include user agent data - default: false
 */
router.post('/export/:eventId', exportCheckins);

module.exports = router;
