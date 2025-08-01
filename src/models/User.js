const bcrypt = require('bcrypt');

class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.username = data.username || '';
    this.email = data.email || '';
    this.passwordHash = data.passwordHash || null;
    this.role = data.role || 'admin';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.lastLogin = data.lastLogin || null;
    this.createdAt = data.createdAt || null;
    this.updatedAt = data.updatedAt || null;
  }

  validate() {
    const errors = [];

    // Validate username
    if (!this.username || typeof this.username !== 'string' || this.username.trim().length === 0) {
      errors.push('Username is required and must be a non-empty string');
    }
    if (this.username && this.username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    if (this.username && this.username.length > 50) {
      errors.push('Username must be 50 characters or less');
    }
    if (this.username && !/^[a-zA-Z0-9_-]+$/.test(this.username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Validate email
    if (!this.email || typeof this.email !== 'string') {
      errors.push('Email is required and must be a string');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        errors.push('Email must be a valid email address');
      }
      if (this.email.length > 255) {
        errors.push('Email must be 255 characters or less');
      }
    }

    // Validate role
    if (!['admin', 'super_admin'].includes(this.role)) {
      errors.push('Role must be either "admin" or "super_admin"');
    }

    // Validate isActive
    if (typeof this.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }

    // Validate lastLogin (if present)
    if (this.lastLogin !== null) {
      const lastLoginDate = new Date(this.lastLogin);
      if (isNaN(lastLoginDate.getTime())) {
        errors.push('Last login must be a valid date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required and must be a string');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be 128 characters or less');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async setPassword(password) {
    const validation = this.validatePassword(password);
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password) {
    if (!this.passwordHash) {
      return false;
    }
    return await bcrypt.compare(password, this.passwordHash);
  }

  toJSON() {
    // Never include password hash in JSON output
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toSafeJSON() {
    // Even more restricted version for public APIs
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      isActive: this.isActive
    };
  }
}

module.exports = User;