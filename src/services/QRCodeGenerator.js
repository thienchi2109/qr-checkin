const QRCode = require('qrcode');
const crypto = require('crypto');
const QRCodeCacheService = require('./QRCodeCacheService');

/**
 * QR Code Generator Service with AES-256 encryption and Redis caching
 * Generates time-based QR codes with configurable expiration
 */
class QRCodeGenerator {
  constructor() {
    // Use environment variable or generate a secure key
    this.encryptionKey = process.env.QR_ENCRYPTION_KEY || this.generateSecureKey();
    this.defaultExpirationSeconds = 60; // 1 minute default
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.cacheService = new QRCodeCacheService();
  }

  /**
   * Generate a secure encryption key
   * @returns {string} Base64 encoded key
   */
  generateSecureKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Generate QR code with encrypted token and cache it
   * @param {string} eventId - Event identifier
   * @param {number} expirationSeconds - Expiration time in seconds
   * @returns {Promise<Object>} QR code data and metadata
   */
  async generateQRCode(eventId, expirationSeconds = this.defaultExpirationSeconds) {
    try {
      const timestamp = Date.now();
      const expiresAt = timestamp + (expirationSeconds * 1000);
      const nonce = crypto.randomBytes(16).toString('hex');

      // Create token payload
      const tokenPayload = {
        eventId,
        timestamp,
        expiresAt,
        nonce
      };

      // Encrypt the token
      const encryptedToken = this.encryptToken(JSON.stringify(tokenPayload));

      // Create QR code URL
      const qrUrl = `${this.baseUrl}/checkin?event=${eventId}&token=${encryptedToken}&ts=${timestamp}`;

      // Generate QR code image
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      const qrData = {
        qrCodeUrl: qrUrl,
        qrCodeImage: qrCodeDataUrl,
        token: encryptedToken,
        eventId,
        timestamp,
        expiresAt,
        expirationSeconds,
        isValid: true
      };

      // Cache the QR code data
      await this.cacheService.cacheQRCode(eventId, encryptedToken, qrData, expirationSeconds);

      return qrData;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Validate QR code token with cache checking and reuse prevention
   * @param {string} qrToken - Encrypted token from QR code
   * @param {string} eventId - Expected event ID
   * @returns {Promise<Object>} Validation result
   */
  async validateQRCode(qrToken, eventId) {
    try {
      // First check cache validation (includes expiration and reuse check)
      const cacheValidation = await this.cacheService.validateCachedQRCode(eventId, qrToken);
      
      if (!cacheValidation.isValid) {
        return {
          isValid: false,
          isExpired: cacheValidation.isExpired,
          isUsed: cacheValidation.isUsed,
          isValidEvent: false,
          error: cacheValidation.error || 'Cache validation failed',
          eventId: cacheValidation.eventId,
          timestamp: cacheValidation.timestamp,
          expiresAt: cacheValidation.expiresAt,
          timeRemaining: cacheValidation.timeRemaining
        };
      }

      // Decrypt and validate the token structure
      const decryptedPayload = this.decryptToken(qrToken);
      const tokenData = JSON.parse(decryptedPayload);

      const now = Date.now();
      const isExpired = now > tokenData.expiresAt;
      const isValidEvent = tokenData.eventId === eventId;
      const isUsed = await this.cacheService.isTokenUsed(qrToken);

      const validationResult = {
        isValid: !isExpired && isValidEvent && !isUsed,
        isExpired,
        isUsed,
        isValidEvent,
        eventId: tokenData.eventId,
        timestamp: tokenData.timestamp,
        expiresAt: tokenData.expiresAt,
        timeRemaining: Math.max(0, tokenData.expiresAt - now)
      };

      return validationResult;
    } catch (error) {
      return {
        isValid: false,
        isExpired: true,
        isUsed: false,
        isValidEvent: false,
        error: 'Invalid or corrupted token'
      };
    }
  }

  /**
   * Refresh QR code for an event (generate new one)
   * @param {string} eventId - Event identifier
   * @param {number} expirationSeconds - Expiration time in seconds
   * @returns {Promise<Object>} New QR code data
   */
  async refreshQRCode(eventId, expirationSeconds = this.defaultExpirationSeconds) {
    return await this.generateQRCode(eventId, expirationSeconds);
  }

  /**
   * Get active QR code from cache
   * @param {string} eventId - Event identifier
   * @returns {Promise<Object|null>} Active QR code data or null if none found
   */
  async getActiveQRCode(eventId) {
    try {
      return await this.cacheService.getActiveQRCodeForEvent(eventId);
    } catch (error) {
      console.error('Failed to get active QR code:', error);
      return null;
    }
  }

  /**
   * Mark QR code token as used to prevent reuse
   * @param {string} qrToken - QR token to mark as used
   * @param {number} ttlSeconds - Time to keep the used token record
   * @returns {Promise<boolean>} Success status
   */
  async markTokenAsUsed(qrToken, ttlSeconds = 3600) {
    try {
      return await this.cacheService.markTokenAsUsed(qrToken, ttlSeconds);
    } catch (error) {
      console.error('Failed to mark token as used:', error);
      return false;
    }
  }

  /**
   * Get cache statistics for an event
   * @param {string} eventId - Event identifier
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats(eventId) {
    try {
      return await this.cacheService.getCacheStats(eventId);
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        eventId,
        totalCodes: 0,
        activeCodes: 0,
        expiredCodes: 0,
        cacheHitRatio: 0,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * Encrypt token using AES-256-CBC
   * @param {string} text - Text to encrypt
   * @returns {string} Base64 encoded encrypted data
   */
  encryptToken(text) {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher with proper key derivation
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      const combined = iv.toString('hex') + ':' + encrypted;
      
      // Return base64 encoded result
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt token using AES-256-CBC
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} Decrypted text
   */
  decryptToken(encryptedData) {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64').toString();
      
      // Split IV and encrypted data
      const parts = combined.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      // Create decipher with proper key derivation (same as encryption)
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code as SVG string
   * @param {string} eventId - Event identifier
   * @param {number} expirationSeconds - Expiration time in seconds
   * @returns {Promise<Object>} QR code SVG and metadata
   */
  async generateQRCodeSVG(eventId, expirationSeconds = this.defaultExpirationSeconds) {
    try {
      const qrData = await this.generateQRCode(eventId, expirationSeconds);
      
      // Generate SVG version
      const qrCodeSVG = await QRCode.toString(qrData.qrCodeUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return {
        ...qrData,
        qrCodeSVG
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code SVG: ${error.message}`);
    }
  }

  /**
   * Batch generate QR codes for multiple events
   * @param {Array<string>} eventIds - Array of event identifiers
   * @param {number} expirationSeconds - Expiration time in seconds
   * @returns {Promise<Array<Object>>} Array of QR code data
   */
  async batchGenerateQRCodes(eventIds, expirationSeconds = this.defaultExpirationSeconds) {
    try {
      const promises = eventIds.map(eventId => 
        this.generateQRCode(eventId, expirationSeconds)
      );
      
      return await Promise.all(promises);
    } catch (error) {
      throw new Error(`Batch QR code generation failed: ${error.message}`);
    }
  }
}

module.exports = QRCodeGenerator;