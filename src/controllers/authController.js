const { pool } = require('../config/database');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

/**
 * Admin Authentication Controller
 * Handles login, logout, and user management for admin users
 * Requirements: 1.1, 4.1
 */

/**
 * Admin login endpoint
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
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

      // Verify password
      const isValidPassword = await user.verifyPassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        });
      }

      // Update last login timestamp
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
      const token = generateToken(user);

      // Return success response
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Login failed due to server error'
    });
  }
};

/**
 * Admin logout endpoint
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // In a more sophisticated implementation, we might maintain a blacklist
    // of revoked tokens in Redis. For now, we'll rely on client-side token removal.
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGOUT_FAILED',
      message: 'Logout failed due to server error'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    }

    res.json({
      success: true,
      data: {
        user: req.user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'PROFILE_ERROR',
      message: 'Failed to retrieve user profile'
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    }

    const { username, email } = req.body;
    const updates = {};
    const params = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (username !== undefined) {
      updates.username = username;
      params.push(username);
    }
    
    if (email !== undefined) {
      updates.email = email.toLowerCase().trim();
      params.push(updates.email);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_UPDATES',
        message: 'No valid fields to update'
      });
    }

    // Create updated user instance for validation
    const updatedUser = new User({
      ...req.user,
      ...updates
    });

    const validation = updatedUser.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Profile validation failed',
        details: validation.errors
      });
    }

    // Update database
    const client = await pool.connect();
    try {
      const setClause = Object.keys(updates).map((key, index) => 
        `${key} = $${index + 1}`
      ).join(', ');
      
      params.push(req.user.id);
      
      const result = await client.query(
        `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      const userData = result.rows[0];
      const user = new User({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        isActive: userData.is_active,
        lastLogin: userData.last_login,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email address is already in use'
      });
    }

    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PASSWORDS',
        message: 'Current password and new password are required'
      });
    }

    // Verify current password
    const isValidPassword = await req.user.verifyPassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect'
      });
    }

    // Validate new password
    const passwordValidation = req.user.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_NEW_PASSWORD',
        message: 'New password does not meet requirements',
        details: passwordValidation.errors
      });
    }

    // Hash new password
    await req.user.setPassword(newPassword);

    // Update database
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [req.user.passwordHash, req.user.id]
      );

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'PASSWORD_CHANGE_FAILED',
      message: 'Failed to change password'
    });
  }
};

module.exports = {
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword
};