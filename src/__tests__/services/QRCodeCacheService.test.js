const QRCodeCacheService = require('../../services/QRCodeCacheService');
const redisClient = require('../../config/redis');

// Mock Redis client
jest.mock('../../config/redis', () => ({
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ping: jest.fn()
}));

describe('QRCodeCacheService', () => {
  let cacheService;
  const testEventId = 'test-event-123';
  const testToken = 'test-token-abc';
  const testQRData = {
    qrCodeUrl: 'https://example.com/checkin?event=test-event-123&token=test-token-abc',
    qrCodeImage: 'data:image/png;base64,test-image-data',
    timestamp: Date.now(),
    expiresAt: Date.now() + 60000,
    expirationSeconds: 60
  };

  beforeEach(() => {
    cacheService = new QRCodeCacheService();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(cacheService.keyPrefix).toBe('qr');
      expect(cacheService.usedTokensPrefix).toBe('used_qr');
      expect(cacheService.defaultTTL).toBe(60);
    });
  });

  describe('generateCacheKey', () => {
    test('should generate correct cache key format', () => {
      const key = cacheService.generateCacheKey(testEventId, testToken);
      expect(key).toBe(`qr:${testEventId}:${testToken}`);
    });
  });

  describe('generateUsedTokenKey', () => {
    test('should generate correct used token key format', () => {
      const key = cacheService.generateUsedTokenKey(testToken);
      expect(key).toBe(`used_qr:${testToken}`);
    });
  });

  describe('cacheQRCode', () => {
    test('should cache QR code data successfully', async () => {
      redisClient.setEx.mockResolvedValue('OK');

      const result = await cacheService.cacheQRCode(testEventId, testToken, testQRData, 60);

      expect(result).toBe(true);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `qr:${testEventId}:${testToken}`,
        60,
        expect.stringContaining(testEventId)
      );

      // Verify the cached data structure
      const cachedDataCall = redisClient.setEx.mock.calls[0][2];
      const cachedData = JSON.parse(cachedDataCall);
      expect(cachedData).toMatchObject({
        eventId: testEventId,
        token: testToken,
        qrCodeUrl: testQRData.qrCodeUrl,
        qrCodeImage: testQRData.qrCodeImage,
        isUsed: false
      });
      expect(cachedData.cachedAt).toBeDefined();
    });

    test('should handle caching errors gracefully', async () => {
      redisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.cacheQRCode(testEventId, testToken, testQRData, 60);

      expect(result).toBe(false);
    });

    test('should use default TTL when not specified', async () => {
      redisClient.setEx.mockResolvedValue('OK');

      await cacheService.cacheQRCode(testEventId, testToken, testQRData);

      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.any(String),
        cacheService.defaultTTL,
        expect.any(String)
      );
    });
  });

  describe('getCachedQRCode', () => {
    test('should retrieve cached QR code data', async () => {
      const cachedData = {
        eventId: testEventId,
        token: testToken,
        qrCodeUrl: testQRData.qrCodeUrl,
        isUsed: false,
        cachedAt: Date.now()
      };
      redisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheService.getCachedQRCode(testEventId, testToken);

      expect(result).toEqual(cachedData);
      expect(redisClient.get).toHaveBeenCalledWith(`qr:${testEventId}:${testToken}`);
    });

    test('should return null when QR code not found', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await cacheService.getCachedQRCode(testEventId, testToken);

      expect(result).toBeNull();
    });

    test('should handle retrieval errors gracefully', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getCachedQRCode(testEventId, testToken);

      expect(result).toBeNull();
    });

    test('should handle invalid JSON data', async () => {
      redisClient.get.mockResolvedValue('invalid-json');

      const result = await cacheService.getCachedQRCode(testEventId, testToken);

      expect(result).toBeNull();
    });
  });

  describe('validateCachedQRCode', () => {
    test('should validate non-expired, unused QR code', async () => {
      const cachedData = {
        eventId: testEventId,
        token: testToken,
        timestamp: Date.now() - 30000,
        expiresAt: Date.now() + 30000,
        isUsed: false
      };
      redisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));
      redisClient.get.mockResolvedValueOnce(null); // Token not used

      const result = await cacheService.validateCachedQRCode(testEventId, testToken);

      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.isUsed).toBe(false);
      expect(result.eventId).toBe(testEventId);
      expect(result.timeRemaining).toBeGreaterThan(0);
    });

    test('should reject expired QR code', async () => {
      const cachedData = {
        eventId: testEventId,
        token: testToken,
        timestamp: Date.now() - 120000,
        expiresAt: Date.now() - 60000, // Expired 1 minute ago
        isUsed: false
      };
      redisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));
      redisClient.get.mockResolvedValueOnce(null); // Token not used

      const result = await cacheService.validateCachedQRCode(testEventId, testToken);

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.isUsed).toBe(false);
      expect(result.timeRemaining).toBe(0);
    });

    test('should reject used QR code', async () => {
      const cachedData = {
        eventId: testEventId,
        token: testToken,
        timestamp: Date.now() - 30000,
        expiresAt: Date.now() + 30000,
        isUsed: false
      };
      const usedTokenData = { token: testToken, usedAt: Date.now() };
      redisClient.get.mockResolvedValueOnce(JSON.stringify(cachedData));
      redisClient.get.mockResolvedValueOnce(JSON.stringify(usedTokenData)); // Token is used

      const result = await cacheService.validateCachedQRCode(testEventId, testToken);

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.isUsed).toBe(true);
    });

    test('should reject QR code not found in cache', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await cacheService.validateCachedQRCode(testEventId, testToken);

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.isUsed).toBe(false);
      expect(result.error).toBe('QR code not found in cache');
    });

    test('should handle validation errors gracefully', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.validateCachedQRCode(testEventId, testToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('QR code not found in cache');
    });
  });

  describe('markTokenAsUsed', () => {
    test('should mark token as used successfully', async () => {
      redisClient.setEx.mockResolvedValue('OK');

      const result = await cacheService.markTokenAsUsed(testToken, 3600);

      expect(result).toBe(true);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `used_qr:${testToken}`,
        3600,
        expect.stringContaining(testToken)
      );

      // Verify the used token data structure
      const usedDataCall = redisClient.setEx.mock.calls[0][2];
      const usedData = JSON.parse(usedDataCall);
      expect(usedData).toMatchObject({
        token: testToken,
        markedBy: 'QRCodeCacheService'
      });
      expect(usedData.usedAt).toBeDefined();
    });

    test('should use default TTL when not specified', async () => {
      redisClient.setEx.mockResolvedValue('OK');

      await cacheService.markTokenAsUsed(testToken);

      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.any(String),
        3600, // Default TTL
        expect.any(String)
      );
    });

    test('should handle marking errors gracefully', async () => {
      redisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.markTokenAsUsed(testToken);

      expect(result).toBe(false);
    });
  });

  describe('isTokenUsed', () => {
    test('should return true for used token', async () => {
      const usedData = { token: testToken, usedAt: Date.now() };
      redisClient.get.mockResolvedValue(JSON.stringify(usedData));

      const result = await cacheService.isTokenUsed(testToken);

      expect(result).toBe(true);
      expect(redisClient.get).toHaveBeenCalledWith(`used_qr:${testToken}`);
    });

    test('should return false for unused token', async () => {
      redisClient.get.mockResolvedValue(null);

      const result = await cacheService.isTokenUsed(testToken);

      expect(result).toBe(false);
    });

    test('should return false on error to avoid blocking valid requests', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.isTokenUsed(testToken);

      expect(result).toBe(false);
    });
  });

  describe('getActiveQRCodeForEvent', () => {
    test('should return most recent active QR code', async () => {
      const keys = [`qr:${testEventId}:token1`, `qr:${testEventId}:token2`];
      const qrData1 = {
        eventId: testEventId,
        token: 'token1',
        timestamp: Date.now() - 60000,
        expiresAt: Date.now() + 30000
      };
      const qrData2 = {
        eventId: testEventId,
        token: 'token2',
        timestamp: Date.now() - 30000, // More recent
        expiresAt: Date.now() + 60000
      };

      redisClient.keys.mockResolvedValue(keys);
      redisClient.get.mockResolvedValueOnce(JSON.stringify(qrData1));
      redisClient.get.mockResolvedValueOnce(JSON.stringify(qrData2));

      const result = await cacheService.getActiveQRCodeForEvent(testEventId);

      expect(result).toEqual(qrData2); // Should return the more recent one
      expect(redisClient.keys).toHaveBeenCalledWith(`qr:${testEventId}:*`);
    });

    test('should return null when no active QR codes found', async () => {
      redisClient.keys.mockResolvedValue([]);

      const result = await cacheService.getActiveQRCodeForEvent(testEventId);

      expect(result).toBeNull();
    });

    test('should filter out expired QR codes', async () => {
      const keys = [`qr:${testEventId}:token1`];
      const expiredQrData = {
        eventId: testEventId,
        token: 'token1',
        timestamp: Date.now() - 120000,
        expiresAt: Date.now() - 60000 // Expired
      };

      redisClient.keys.mockResolvedValue(keys);
      redisClient.get.mockResolvedValue(JSON.stringify(expiredQrData));

      const result = await cacheService.getActiveQRCodeForEvent(testEventId);

      expect(result).toBeNull();
    });

    test('should handle errors gracefully', async () => {
      redisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getActiveQRCodeForEvent(testEventId);

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredQRCodes', () => {
    test('should clean up expired QR codes', async () => {
      const keys = [`qr:${testEventId}:token1`, `qr:${testEventId}:token2`];
      const expiredQrData = {
        eventId: testEventId,
        token: 'token1',
        expiresAt: Date.now() - 60000 // Expired
      };
      const activeQrData = {
        eventId: testEventId,
        token: 'token2',
        expiresAt: Date.now() + 60000 // Active
      };

      redisClient.keys.mockResolvedValue(keys);
      redisClient.get.mockResolvedValueOnce(JSON.stringify(expiredQrData));
      redisClient.get.mockResolvedValueOnce(JSON.stringify(activeQrData));
      redisClient.del.mockResolvedValue(1);

      const result = await cacheService.cleanupExpiredQRCodes(testEventId);

      expect(result).toBe(1);
      expect(redisClient.del).toHaveBeenCalledWith(`qr:${testEventId}:token1`);
      expect(redisClient.del).toHaveBeenCalledTimes(1);
    });

    test('should return 0 when no expired codes found', async () => {
      const keys = [`qr:${testEventId}:token1`];
      const activeQrData = {
        eventId: testEventId,
        token: 'token1',
        expiresAt: Date.now() + 60000 // Active
      };

      redisClient.keys.mockResolvedValue(keys);
      redisClient.get.mockResolvedValue(JSON.stringify(activeQrData));

      const result = await cacheService.cleanupExpiredQRCodes(testEventId);

      expect(result).toBe(0);
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      redisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.cleanupExpiredQRCodes(testEventId);

      expect(result).toBe(0);
    });
  });

  describe('deleteQRCode', () => {
    test('should delete QR code successfully', async () => {
      redisClient.del.mockResolvedValue(1);

      const result = await cacheService.deleteQRCode(testEventId, testToken);

      expect(result).toBe(true);
      expect(redisClient.del).toHaveBeenCalledWith(`qr:${testEventId}:${testToken}`);
    });

    test('should return false when QR code not found', async () => {
      redisClient.del.mockResolvedValue(0);

      const result = await cacheService.deleteQRCode(testEventId, testToken);

      expect(result).toBe(false);
    });

    test('should handle deletion errors gracefully', async () => {
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.deleteQRCode(testEventId, testToken);

      expect(result).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    test('should return cache statistics', async () => {
      const keys = [`qr:${testEventId}:token1`, `qr:${testEventId}:token2`, `qr:${testEventId}:token3`];
      const activeQrData = {
        eventId: testEventId,
        expiresAt: Date.now() + 60000 // Active
      };
      const expiredQrData = {
        eventId: testEventId,
        expiresAt: Date.now() - 60000 // Expired
      };

      redisClient.keys.mockResolvedValue(keys);
      redisClient.get.mockResolvedValueOnce(JSON.stringify(activeQrData));
      redisClient.get.mockResolvedValueOnce(JSON.stringify(activeQrData));
      redisClient.get.mockResolvedValueOnce(JSON.stringify(expiredQrData));

      const result = await cacheService.getCacheStats(testEventId);

      expect(result).toMatchObject({
        eventId: testEventId,
        totalCodes: 3,
        activeCodes: 2,
        expiredCodes: 1,
        cacheHitRatio: 2/3
      });
      expect(result.timestamp).toBeDefined();
    });

    test('should handle empty cache', async () => {
      redisClient.keys.mockResolvedValue([]);

      const result = await cacheService.getCacheStats(testEventId);

      expect(result).toMatchObject({
        eventId: testEventId,
        totalCodes: 0,
        activeCodes: 0,
        expiredCodes: 0,
        cacheHitRatio: 0
      });
    });

    test('should handle stats errors gracefully', async () => {
      redisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getCacheStats(testEventId);

      expect(result).toMatchObject({
        eventId: testEventId,
        totalCodes: 0,
        activeCodes: 0,
        expiredCodes: 0,
        cacheHitRatio: 0,
        error: 'Redis error'
      });
    });
  });

  describe('flushEventQRCodes', () => {
    test('should flush all QR codes for event', async () => {
      const keys = [`qr:${testEventId}:token1`, `qr:${testEventId}:token2`];
      redisClient.keys.mockResolvedValue(keys);
      redisClient.del.mockResolvedValue(2);

      const result = await cacheService.flushEventQRCodes(testEventId);

      expect(result).toBe(2);
      expect(redisClient.del).toHaveBeenCalledWith(keys);
    });

    test('should return 0 when no QR codes found', async () => {
      redisClient.keys.mockResolvedValue([]);

      const result = await cacheService.flushEventQRCodes(testEventId);

      expect(result).toBe(0);
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    test('should handle flush errors gracefully', async () => {
      redisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.flushEventQRCodes(testEventId);

      expect(result).toBe(0);
    });
  });

  describe('isHealthy', () => {
    test('should return true when Redis is healthy', async () => {
      redisClient.ping.mockResolvedValue('PONG');

      const result = await cacheService.isHealthy();

      expect(result).toBe(true);
      expect(redisClient.ping).toHaveBeenCalled();
    });

    test('should return false when Redis is unhealthy', async () => {
      redisClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete QR code lifecycle with caching', async () => {
      // Mock successful operations
      redisClient.setEx.mockResolvedValue('OK');
      redisClient.get.mockResolvedValueOnce(JSON.stringify({
        eventId: testEventId,
        token: testToken,
        timestamp: Date.now() - 30000,
        expiresAt: Date.now() + 30000,
        isUsed: false
      }));
      redisClient.get.mockResolvedValueOnce(null); // Token not used initially
      redisClient.get.mockResolvedValueOnce(JSON.stringify({ token: testToken })); // Token used after marking

      // Cache QR code
      const cacheResult = await cacheService.cacheQRCode(testEventId, testToken, testQRData);
      expect(cacheResult).toBe(true);

      // Validate QR code (should be valid)
      const validationResult = await cacheService.validateCachedQRCode(testEventId, testToken);
      expect(validationResult.isValid).toBe(true);

      // Mark token as used
      const markResult = await cacheService.markTokenAsUsed(testToken);
      expect(markResult).toBe(true);

      // Check if token is used
      const isUsed = await cacheService.isTokenUsed(testToken);
      expect(isUsed).toBe(true);
    });
  });
});