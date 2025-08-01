const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

/**
 * Authentication Routes
 * Handles admin login, logout, and profile management
 * Requirements: 1.1, 4.1
 */

// Public routes (no authentication required)
router.post('/login', login);

// Protected routes (authentication required)
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

// Admin-only routes (admin role required)
router.get('/admin-test', authenticate, authorize(['admin', 'super_admin']), (req, res) => {
  res.json({
    success: true,
    message: 'Admin access granted',
    user: req.user.toSafeJSON()
  });
});

module.exports = router;