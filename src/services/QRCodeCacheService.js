const redisClient = require('../config/redis');

/**
 * QR Code Cache Service using Redis
 * Handles caching of QR codes with TTL-based expiration and reuse prevention
 */
class QRCodeCacheService {
  constructor() {
    this.keyPrefix = 'qr';
    this.usedTokensPrefix = 'used_qr';
    this.defaultTTL = 60; // 1 minute default
  }

  /**
   * Generate cache key for QR code
   * @param {string} eventId - Event identifier
   * @param {string} token - QR token
   * @returns {string} Cache key
   */
  generateCacheKey(eventId, token) {
    return `${this.keyPrefix}:${eventId}:${token}`;
  }

  /**
   * Generate cache key for used tokens
   * @param {string} token - QR token
   * @returns {string} Used token cache key
   */
  generateUsedTokenKey(token) {
    return `${this.usedTokensPrefix}:${token}`;
  }

  /**
   * Store QR code data in cache
   * @param {string} eventId - Event identifier
   * @param {string} token - QR token
   * @param {Object} qrData - QR code data to cache
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async cacheQRCode(eventId, token, qrData, ttlSeconds = this.defaultTTL) {
    try {
      const cacheKey = this.generateCacheKey(eventId, token);
      const cacheData = {
        eventId,
        token,
        qrCodeUrl: qrData.qrCodeUrl,
        qrCodeImage: qrData.qrCodeImage,
        timestamp: qrData.timestamp,
        expiresAt: qrData.expiresAt,
        expirationSeconds: qrData.expirationSeconds,
        isUsed: false,
        cachedAt: Date.now()
      };

      // Store in Redis with TTL
      await redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error('Failed to cache QR code:', error);
      return false;
    }
  }

  /**
   * Retrieve QR code data from cache
   * @param {string} eventId - Event identifier
   * @param {string} token - QR token
   * @returns {Promise<Object|null>} Cached QR code data or null if not found
   */
  async getCachedQRCode(eventId, token) {
    try {
      const cacheKey = this.generateCacheKey(eventId, token);
      const cachedData = await redisClient.get(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      return JSON.parse(cachedData);
    } catch (error) {
      console.error('Failed to retrieve cached QR code:', error);
      return null;
    }
  }

  /**
   * Check if QR code exists and is valid
   * @param {string} eventId - Event identifier
   * @param {string} token - QR token
   * @returns {Promise<Object>} Validation result
   */
  async validateCachedQRCode(eventId, token) {
    try {
      const cachedData = await this.getCachedQRCode(eventId, token);
      
      if (!cachedData) {
        return {
          isValid: false,
          isExpired: true,
          isUsed: false,
          error: 'QR code not found in cache'
        };
      }

      const now = Date.now();
      const isExpired = now > cachedData.expiresAt;
      const isUsed = await this.isTokenUsed(token);

      return {
        isValid: !isExpired && !isUsed,
        isExpired,
        isUsed,
        eventId: cachedData.eventId,
        timestamp: cachedData.timestamp,
        expiresAt: cachedData.expiresAt,
        timeRemaining: Math.max(0, cachedData.expiresAt - now),
        cachedAt: cachedData.cachedAt
      };
    } catch (error) {
      console.error('Failed to validate cached QR code:', error);
      return {
        isValid: false,
        isExpired: true,
        isUsed: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Mark QR token as used to prevent reuse
   * @param {string} token - QR token
   * @param {number} ttlSeconds - Time to keep the used token record
   * @returns {Promise<boolean>} Success status
   */
  async markTokenAsUsed(token, ttlSeconds = 3600) { // Keep used tokens for 1 hour
    try {
      const usedTokenKey = this.generateUsedTokenKey(token);
      const usedData = {
        token,
        usedAt: Date.now(),
        markedBy: 'QRCodeCacheService'
      };

      await redisClient.setEx(usedTokenKey, ttlSeconds, JSON.stringify(usedData));
      return true;
    } catch (error) {
      console.error('Failed to mark token as used:', error);
      return false;
    }
  }

  /**
   * Check if token has been used
   * @param {string} token - QR token
   * @returns {Promise<boolean>} True if token has been used
   */
  async isTokenUsed(token) {
    try {
      const usedTokenKey = this.generateUsedTokenKey(token);
      const usedData = await redisClient.get(usedTokenKey);
      return usedData !== null;
    } catch (error) {
      console.error('Failed to check if token is used:', error);
      return false; // Assume not used on error to avoid blocking valid requests
    }
  }

  /**
   * Get active QR code for an event (most recent non-expired)
   * @param {string} eventId - Event identifier
   * @returns {Promise<Object|null>} Active QR code data or null
   */
  async getActiveQRCodeForEvent(eventId) {
    try {
      // Search for keys matching the event pattern
      const pattern = `${this.keyPrefix}:${eventId}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length === 0) {
        return null;
      }

      // Get all QR codes for this event
      const qrCodes = [];
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const qrData = JSON.parse(data);
          const now = Date.now();
          
          // Only include non-expired codes
          if (now <= qrData.expiresAt) {
            qrCodes.push(qrData);
          }
        }
      }

      if (qrCodes.length === 0) {
        return null;
      }

      // Return the most recently created QR code
      return qrCodes.sort((a, b) => b.timestamp - a.timestamp)[0];
    } catch (error) {
      console.error('Failed to get active QR code for event:', error);
      return null;
    }
  }

  /**
   * Clean up expired QR codes for an event
   * @param {string} eventId - Event identifier
   * @returns {Promise<number>} Number of cleaned up codes
   */
  async cleanupExpiredQRCodes(eventId) {
    try {
      const pattern = `${this.keyPrefix}:${eventId}:*`;
      const keys = await redisClient.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const qrData = JSON.parse(data);
          const now = Date.now();
          
          // Delete expired codes
          if (now > qrData.expiresAt) {
            await redisClient.del(key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup expired QR codes:', error);
      return 0;
    }
  }

  /**
   * Delete specific QR code from cache
   * @param {string} eventId - Event identifier
   * @param {string} token - QR token
   * @returns {Promise<boolean>} Success status
   */
  async deleteQRCode(eventId, token) {
    try {
      const cacheKey = this.generateCacheKey(eventId, token);
      const result = await redisClient.del(cacheKey);
      return result > 0;
    } catch (error) {
      console.error('Failed to delete QR code from cache:', error);
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
      const pattern = `${this.keyPrefix}:${eventId}:*`;
      const keys = await redisClient.keys(pattern);
      
      let totalCodes = 0;
      let activeCodes = 0;
      let expiredCodes = 0;
      const now = Date.now();

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          totalCodes++;
          const qrData = JSON.parse(data);
          
          if (now <= qrData.expiresAt) {
            activeCodes++;
          } else {
            expiredCodes++;
          }
        }
      }

      return {
        eventId,
        totalCodes,
        activeCodes,
        expiredCodes,
        cacheHitRatio: totalCodes > 0 ? (activeCodes / totalCodes) : 0,
        timestamp: now
      };
    } catch (error) {
      console.error('Failed to get cache statistics:', error);
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
   * Flush all QR codes for an event
   * @param {string} eventId - Event identifier
   * @returns {Promise<number>} Number of deleted codes
   */
  async flushEventQRCodes(eventId) {
    try {
      const pattern = `${this.keyPrefix}:${eventId}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await redisClient.del(keys);
      return result;
    } catch (error) {
      console.error('Failed to flush event QR codes:', error);
      return 0;
    }
  }

  /**
   * Check Redis connection health
   * @returns {Promise<boolean>} Connection status
   */
  async isHealthy() {
    try {
      await redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

module.exports = QRCodeCacheService;