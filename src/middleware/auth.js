const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const User = require('../models/User');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and attaches user information to request
 * Requirements: 1.1, 4.1
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token for authenticated user
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'qr-checkin-system',
    audience: 'admin-dashboard'
  });
};

/**
 * Verify JWT token and extract user information
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'qr-checkin-system',
    audience: 'admin-dashboard'
  });
};

/**
 * Authentication middleware - validates JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Authorization token is required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Fetch current user data from database
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found or inactive'
        });
      }

      const userData = result.rows[0];
      const user = new User({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        passwordHash: userData.password_hash,
        role: userData.role,
        isActive: userData.is_active,
        lastLogin: userData.last_login,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      });

      // Attach user to request object
      req.user = user;
      req.token = token;

      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid token format'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Authentication failed'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    }

    // If no specific roles required, just check if user is authenticated
    if (allowedRoles.length === 0) {
      return next();
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // Fetch user data
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (result.rows.length > 0) {
        const userData = result.rows[0];
        req.user = new User({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          isActive: userData.is_active,
          lastLogin: userData.last_login,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at
        });
        req.token = token;
      }
    } finally {
      client.release();
    }

    next();
  } catch (error) {
    // Ignore authentication errors in optional auth
    // Don't set req.user to maintain undefined state
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authenticateToken: authenticate, // Alias for backward compatibility
  authorize,
  requireAdmin: authorize('admin'), // Helper for admin-only routes
  optionalAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN
};