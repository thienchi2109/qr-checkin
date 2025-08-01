const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * File upload utility for handling selfie images with validation and secure storage
 */
class FileUploadUtil {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'selfies');
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    this.maxDimensions = { width: 2048, height: 2048 };
    
    this.initializeUploadDirectory();
  }

  /**
   * Initialize upload directory if it doesn't exist
   */
  async initializeUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generate secure filename with unique identifier
   * @param {string} originalName - Original filename
   * @returns {string} Secure filename
   */
  generateSecureFilename(originalName) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const extension = path.extname(originalName).toLowerCase();
    return `selfie_${timestamp}_${randomBytes}${extension}`;
  }

  /**
   * Validate file type and size
   * @param {Object} file - Multer file object
   * @returns {Object} Validation result
   */
  validateFile(file) {
    const errors = [];

    // Check file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check file extension matches mime type
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedExtensions = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    };

    const validExtensions = expectedExtensions[file.mimetype] || [];
    if (!validExtensions.includes(extension)) {
      errors.push('File extension does not match file type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create multer storage configuration
   * @returns {Object} Multer storage configuration
   */
  createStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const secureFilename = this.generateSecureFilename(file.originalname);
        cb(null, secureFilename);
      }
    });
  }

  /**
   * Create multer upload middleware with validation
   * @returns {Object} Multer upload middleware
   */
  createUploadMiddleware() {
    const storage = this.createStorage();
    
    return multer({
      storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 1 // Only allow one file
      },
      fileFilter: (req, file, cb) => {
        const validation = this.validateFile(file);
        if (validation.isValid) {
          cb(null, true);
        } else {
          cb(new Error(validation.errors.join('; ')), false);
        }
      }
    });
  }

  /**
   * Get file URL for stored file
   * @param {string} filename - Stored filename
   * @returns {string} File URL
   */
  getFileUrl(filename) {
    return `/uploads/selfies/${filename}`;
  }

  /**
   * Delete uploaded file
   * @param {string} filename - Filename to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filename) {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Validate image dimensions (requires sharp or similar library for production)
   * For now, this is a placeholder that always returns valid
   * @param {string} filePath - Path to uploaded file
   * @returns {Promise<Object>} Validation result
   */
  async validateImageDimensions(filePath) {
    // TODO: Implement actual image dimension validation with sharp
    // For now, return valid to allow testing
    return {
      isValid: true,
      dimensions: { width: 0, height: 0 },
      errors: []
    };
  }
}

module.exports = FileUploadUtil;