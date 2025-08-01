const QRCodeGenerator = require('../../services/QRCodeGenerator');

// Mock the QRCodeCacheService
jest.mock('../../services/QRCodeCacheService', () => {
    return jest.fn().mockImplementation(() => ({
        cacheQRCode: jest.fn().mockResolvedValue(true),
        validateCachedQRCode: jest.fn().mockResolvedValue({
            isValid: true,
            isExpired: false,
            isUsed: false,
            eventId: 'test-event-123',
            timestamp: Date.now() - 30000,
            expiresAt: Date.now() + 30000,
            timeRemaining: 30000
        }),
        getActiveQRCodeForEvent: jest.fn().mockResolvedValue(null),
        markTokenAsUsed: jest.fn().mockResolvedValue(true),
        isTokenUsed: jest.fn().mockResolvedValue(false),
        getCacheStats: jest.fn().mockResolvedValue({
            eventId: 'test-event-123',
            totalCodes: 1,
            activeCodes: 1,
            expiredCodes: 0,
            cacheHitRatio: 1,
            timestamp: Date.now()
        })
    }));
});

describe('QRCodeGenerator', () => {
    let qrGenerator;
    const testEventId = 'test-event-123';
    const testExpirationSeconds = 60;

    beforeEach(() => {
        qrGenerator = new QRCodeGenerator();
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with default values', () => {
            expect(qrGenerator).toBeInstanceOf(QRCodeGenerator);
            expect(qrGenerator.defaultExpirationSeconds).toBe(60);
            expect(qrGenerator.encryptionKey).toBeDefined();
            expect(qrGenerator.baseUrl).toBeDefined();
        });

        test('should use environment variables when available', () => {
            const originalKey = process.env.QR_ENCRYPTION_KEY;
            const originalUrl = process.env.BASE_URL;

            process.env.QR_ENCRYPTION_KEY = 'test-key-123';
            process.env.BASE_URL = 'https://test.example.com';

            const generator = new QRCodeGenerator();
            expect(generator.encryptionKey).toBe('test-key-123');
            expect(generator.baseUrl).toBe('https://test.example.com');

            // Restore original values
            process.env.QR_ENCRYPTION_KEY = originalKey;
            process.env.BASE_URL = originalUrl;
        });
    });

    describe('generateSecureKey', () => {
        test('should generate a base64 encoded key', () => {
            const key = qrGenerator.generateSecureKey();
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);

            // Should be valid base64
            expect(() => Buffer.from(key, 'base64')).not.toThrow();
        });

        test('should generate different keys each time', () => {
            const key1 = qrGenerator.generateSecureKey();
            const key2 = qrGenerator.generateSecureKey();
            expect(key1).not.toBe(key2);
        });
    });

    describe('generateQRCode', () => {
        test('should generate QR code with valid structure', async () => {
            const result = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);

            expect(result).toHaveProperty('qrCodeUrl');
            expect(result).toHaveProperty('qrCodeImage');
            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('eventId', testEventId);
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('expiresAt');
            expect(result).toHaveProperty('expirationSeconds', testExpirationSeconds);
            expect(result).toHaveProperty('isValid', true);
        });

        test('should generate QR code URL with correct format', async () => {
            const result = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);

            // The URL should contain the base URL (either from env or default)
            expect(result.qrCodeUrl).toMatch(/\/checkin\?event=test-event-123&token=.+&ts=\d+$/);
            expect(result.qrCodeUrl).toContain('checkin?event=test-event-123');
        });

        test('should generate QR code image as data URL', async () => {
            const result = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);

            expect(result.qrCodeImage).toMatch(/^data:image\/png;base64,.+/);
        });

        test('should set correct expiration time', async () => {
            const beforeGeneration = Date.now();
            const result = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const afterGeneration = Date.now();

            expect(result.expiresAt).toBeGreaterThanOrEqual(beforeGeneration + (testExpirationSeconds * 1000));
            expect(result.expiresAt).toBeLessThanOrEqual(afterGeneration + (testExpirationSeconds * 1000));
        });

        test('should use default expiration when not specified', async () => {
            const result = await qrGenerator.generateQRCode(testEventId);

            expect(result.expirationSeconds).toBe(qrGenerator.defaultExpirationSeconds);
        });

        test('should generate different tokens for same event', async () => {
            const result1 = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const result2 = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);

            expect(result1.token).not.toBe(result2.token);
        });
    });

    describe('validateQRCode', () => {
        test('should validate valid non-expired token with cache integration', async () => {
            const generated = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const validation = await qrGenerator.validateQRCode(generated.token, testEventId);

            expect(validation.isValid).toBe(true);
            expect(validation.isExpired).toBe(false);
            expect(validation.isUsed).toBe(false);
            expect(validation.isValidEvent).toBe(true);
            expect(validation.eventId).toBe(testEventId);
            expect(validation.timeRemaining).toBeGreaterThan(0);
        });

        test('should reject expired token', async () => {
            // Mock cache service to return expired validation
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: false,
                isExpired: true,
                isUsed: false,
                error: 'QR code expired'
            });

            const generated = await qrGenerator.generateQRCode(testEventId, 0); // Expires immediately
            await new Promise(resolve => setTimeout(resolve, 10));

            const validation = await qrGenerator.validateQRCode(generated.token, testEventId);

            expect(validation.isValid).toBe(false);
            expect(validation.isExpired).toBe(true);
            expect(validation.error).toBeDefined();
        });

        test('should reject used token', async () => {
            // Mock cache service to return used token validation
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: false,
                isExpired: false,
                isUsed: true,
                error: 'QR code already used'
            });

            const generated = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const validation = await qrGenerator.validateQRCode(generated.token, testEventId);

            expect(validation.isValid).toBe(false);
            expect(validation.isUsed).toBe(true);
            expect(validation.error).toBeDefined();
        });

        test('should reject token for wrong event', async () => {
            const generated = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const validation = await qrGenerator.validateQRCode(generated.token, 'wrong-event-id');

            expect(validation.isValid).toBe(false);
            expect(validation.isValidEvent).toBe(false);
            expect(validation.eventId).toBe(testEventId); // Original event ID
        });

        test('should handle invalid token gracefully', async () => {
            // Mock cache service to return not found
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: false,
                isExpired: true,
                isUsed: false,
                error: 'QR code not found in cache'
            });

            const validation = await qrGenerator.validateQRCode('invalid-token', testEventId);

            expect(validation.isValid).toBe(false);
            expect(validation.isExpired).toBe(true);
            expect(validation.isValidEvent).toBe(false);
            expect(validation.error).toBeDefined();
        });

        test('should handle corrupted token gracefully', async () => {
            // Mock cache service to return valid, but token decryption will fail
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: true,
                isExpired: false,
                isUsed: false,
                eventId: testEventId,
                timestamp: Date.now() - 30000,
                expiresAt: Date.now() + 30000,
                timeRemaining: 30000
            });

            const validation = await qrGenerator.validateQRCode('Y29ycnVwdGVkLXRva2Vu', testEventId);

            expect(validation.isValid).toBe(false);
            expect(validation.error).toBe('Invalid or corrupted token');
        });
    });

    describe('refreshQRCode', () => {
        test('should generate new QR code', async () => {
            const original = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const refreshed = await qrGenerator.refreshQRCode(testEventId, testExpirationSeconds);

            expect(refreshed.eventId).toBe(testEventId);
            expect(refreshed.token).not.toBe(original.token);
            expect(refreshed.timestamp).toBeGreaterThan(original.timestamp);
        });

        test('should use default expiration when not specified', async () => {
            const refreshed = await qrGenerator.refreshQRCode(testEventId);

            expect(refreshed.expirationSeconds).toBe(qrGenerator.defaultExpirationSeconds);
        });
    });

    describe('getActiveQRCode', () => {
        test('should return active QR code from cache', async () => {
            const mockActiveQR = {
                eventId: testEventId,
                token: 'active-token',
                timestamp: Date.now() - 30000,
                expiresAt: Date.now() + 30000
            };
            qrGenerator.cacheService.getActiveQRCodeForEvent.mockResolvedValue(mockActiveQR);

            const result = await qrGenerator.getActiveQRCode(testEventId);

            expect(result).toEqual(mockActiveQR);
            expect(qrGenerator.cacheService.getActiveQRCodeForEvent).toHaveBeenCalledWith(testEventId);
        });

        test('should return null when no active QR code found', async () => {
            qrGenerator.cacheService.getActiveQRCodeForEvent.mockResolvedValue(null);

            const result = await qrGenerator.getActiveQRCode(testEventId);

            expect(result).toBeNull();
        });

        test('should handle cache errors gracefully', async () => {
            qrGenerator.cacheService.getActiveQRCodeForEvent.mockRejectedValue(new Error('Cache error'));

            const result = await qrGenerator.getActiveQRCode(testEventId);

            expect(result).toBeNull();
        });
    });

    describe('markTokenAsUsed', () => {
        test('should mark token as used successfully', async () => {
            const testToken = 'test-token-123';
            qrGenerator.cacheService.markTokenAsUsed.mockResolvedValue(true);

            const result = await qrGenerator.markTokenAsUsed(testToken, 3600);

            expect(result).toBe(true);
            expect(qrGenerator.cacheService.markTokenAsUsed).toHaveBeenCalledWith(testToken, 3600);
        });

        test('should use default TTL when not specified', async () => {
            const testToken = 'test-token-123';
            qrGenerator.cacheService.markTokenAsUsed.mockResolvedValue(true);

            await qrGenerator.markTokenAsUsed(testToken);

            expect(qrGenerator.cacheService.markTokenAsUsed).toHaveBeenCalledWith(testToken, 3600);
        });

        test('should handle marking errors gracefully', async () => {
            const testToken = 'test-token-123';
            qrGenerator.cacheService.markTokenAsUsed.mockRejectedValue(new Error('Cache error'));

            const result = await qrGenerator.markTokenAsUsed(testToken);

            expect(result).toBe(false);
        });
    });

    describe('getCacheStats', () => {
        test('should return cache statistics', async () => {
            const mockStats = {
                eventId: testEventId,
                totalCodes: 5,
                activeCodes: 3,
                expiredCodes: 2,
                cacheHitRatio: 0.6,
                timestamp: Date.now()
            };
            qrGenerator.cacheService.getCacheStats.mockResolvedValue(mockStats);

            const result = await qrGenerator.getCacheStats(testEventId);

            expect(result).toEqual(mockStats);
            expect(qrGenerator.cacheService.getCacheStats).toHaveBeenCalledWith(testEventId);
        });

        test('should handle stats errors gracefully', async () => {
            qrGenerator.cacheService.getCacheStats.mockRejectedValue(new Error('Cache error'));

            const result = await qrGenerator.getCacheStats(testEventId);

            expect(result).toMatchObject({
                eventId: testEventId,
                totalCodes: 0,
                activeCodes: 0,
                expiredCodes: 0,
                cacheHitRatio: 0,
                error: 'Cache error'
            });
        });
    });

    describe('Token Encryption/Decryption', () => {
        const testData = 'test-data-to-encrypt';

        test('should encrypt and decrypt data correctly', () => {
            const encrypted = qrGenerator.encryptToken(testData);
            const decrypted = qrGenerator.decryptToken(encrypted);

            expect(decrypted).toBe(testData);
        });

        test('should produce different encrypted output each time', () => {
            const encrypted1 = qrGenerator.encryptToken(testData);
            const encrypted2 = qrGenerator.encryptToken(testData);

            expect(encrypted1).not.toBe(encrypted2);
        });

        test('should handle encryption errors gracefully', () => {
            // Mock crypto to throw error
            const originalCreateCipheriv = require('crypto').createCipheriv;
            require('crypto').createCipheriv = jest.fn(() => {
                throw new Error('Crypto error');
            });

            expect(() => qrGenerator.encryptToken(testData)).toThrow('Encryption failed');

            // Restore original function
            require('crypto').createCipheriv = originalCreateCipheriv;
        });

        test('should handle decryption errors gracefully', () => {
            expect(() => qrGenerator.decryptToken('invalid-data')).toThrow('Decryption failed');
        });

        test('should handle malformed encrypted data', () => {
            const malformedData = Buffer.from('malformed:data:format').toString('base64');
            expect(() => qrGenerator.decryptToken(malformedData)).toThrow('Decryption failed');
        });
    });

    describe('generateQRCodeSVG', () => {
        test('should generate QR code with SVG format', async () => {
            const result = await qrGenerator.generateQRCodeSVG(testEventId, testExpirationSeconds);

            expect(result).toHaveProperty('qrCodeSVG');
            expect(result.qrCodeSVG).toMatch(/^<svg/);
            expect(result.qrCodeSVG.trim()).toMatch(/<\/svg>$/);

            // Should also have all regular QR code properties
            expect(result).toHaveProperty('qrCodeUrl');
            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('eventId', testEventId);
        });
    });

    describe('batchGenerateQRCodes', () => {
        const eventIds = ['event-1', 'event-2', 'event-3'];

        test('should generate QR codes for multiple events', async () => {
            const results = await qrGenerator.batchGenerateQRCodes(eventIds, testExpirationSeconds);

            expect(results).toHaveLength(eventIds.length);

            results.forEach((result, index) => {
                expect(result.eventId).toBe(eventIds[index]);
                expect(result).toHaveProperty('qrCodeUrl');
                expect(result).toHaveProperty('token');
                expect(result.expirationSeconds).toBe(testExpirationSeconds);
            });
        });

        test('should generate different tokens for each event', async () => {
            const results = await qrGenerator.batchGenerateQRCodes(eventIds, testExpirationSeconds);

            const tokens = results.map(r => r.token);
            const uniqueTokens = new Set(tokens);

            expect(uniqueTokens.size).toBe(eventIds.length);
        });

        test('should handle empty event list', async () => {
            const results = await qrGenerator.batchGenerateQRCodes([], testExpirationSeconds);

            expect(results).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle QR code generation errors', async () => {
            // Mock QRCode.toDataURL to throw error
            const QRCode = require('qrcode');
            const originalToDataURL = QRCode.toDataURL;
            QRCode.toDataURL = jest.fn().mockRejectedValue(new Error('QR generation failed'));

            await expect(qrGenerator.generateQRCode(testEventId, testExpirationSeconds))
                .rejects.toThrow('Failed to generate QR code');

            // Restore original function
            QRCode.toDataURL = originalToDataURL;
        });

        test('should handle SVG generation errors', async () => {
            // Mock QRCode.toString to throw error
            const QRCode = require('qrcode');
            const originalToString = QRCode.toString;
            QRCode.toString = jest.fn().mockRejectedValue(new Error('SVG generation failed'));

            await expect(qrGenerator.generateQRCodeSVG(testEventId, testExpirationSeconds))
                .rejects.toThrow('Failed to generate QR code SVG');

            // Restore original function
            QRCode.toString = originalToString;
        });

        test('should handle batch generation errors', async () => {
            // Mock generateQRCode to throw error
            const originalGenerateQRCode = qrGenerator.generateQRCode;
            qrGenerator.generateQRCode = jest.fn().mockRejectedValue(new Error('Generation failed'));

            await expect(qrGenerator.batchGenerateQRCodes(['event-1'], testExpirationSeconds))
                .rejects.toThrow('Batch QR code generation failed');

            // Restore original function
            qrGenerator.generateQRCode = originalGenerateQRCode;
        });
    });

    describe('Integration Tests', () => {
        test('should create valid QR code that can be validated', async () => {
            const generated = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            const validation = await qrGenerator.validateQRCode(generated.token, testEventId);

            expect(validation.isValid).toBe(true);
            expect(validation.eventId).toBe(testEventId);
            expect(validation.timestamp).toBe(generated.timestamp);
            expect(validation.expiresAt).toBe(generated.expiresAt);
        });

        test('should handle complete QR code lifecycle with cache integration', async () => {
            // Generate
            const generated = await qrGenerator.generateQRCode(testEventId, 2); // 2 seconds
            expect(generated.isValid).toBe(true);

            // Validate while valid
            let validation = await qrGenerator.validateQRCode(generated.token, testEventId);
            expect(validation.isValid).toBe(true);

            // Mock cache service to return expired validation
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: false,
                isExpired: true,
                isUsed: false,
                error: 'QR code expired'
            });

            // Validate after expiration
            validation = await qrGenerator.validateQRCode(generated.token, testEventId);
            expect(validation.isValid).toBe(false);
            expect(validation.isExpired).toBe(true);

            // Reset mock for refresh test
            qrGenerator.cacheService.validateCachedQRCode.mockResolvedValue({
                isValid: true,
                isExpired: false,
                isUsed: false,
                eventId: testEventId,
                timestamp: Date.now() - 30000,
                expiresAt: Date.now() + 30000,
                timeRemaining: 30000
            });

            // Refresh
            const refreshed = await qrGenerator.refreshQRCode(testEventId, testExpirationSeconds);
            expect(refreshed.token).not.toBe(generated.token);

            // Validate refreshed token
            validation = await qrGenerator.validateQRCode(refreshed.token, testEventId);
            expect(validation.isValid).toBe(true);
        });

        test('should integrate caching with QR code generation and validation', async () => {
            // Generate QR code (should cache it)
            const generated = await qrGenerator.generateQRCode(testEventId, testExpirationSeconds);
            expect(qrGenerator.cacheService.cacheQRCode).toHaveBeenCalledWith(
                testEventId,
                generated.token,
                generated,
                testExpirationSeconds
            );

            // Validate QR code (should check cache)
            const validation = await qrGenerator.validateQRCode(generated.token, testEventId);
            expect(qrGenerator.cacheService.validateCachedQRCode).toHaveBeenCalledWith(testEventId, generated.token);
            expect(validation.isValid).toBe(true);

            // Mark token as used
            const markResult = await qrGenerator.markTokenAsUsed(generated.token);
            expect(markResult).toBe(true);
            expect(qrGenerator.cacheService.markTokenAsUsed).toHaveBeenCalledWith(generated.token, 3600);

            // Get cache stats
            const stats = await qrGenerator.getCacheStats(testEventId);
            expect(stats).toBeDefined();
            expect(qrGenerator.cacheService.getCacheStats).toHaveBeenCalledWith(testEventId);
        });
    });
});