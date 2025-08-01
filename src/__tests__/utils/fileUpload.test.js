const path = require('path');
const fs = require('fs').promises;
const { FileUploadUtil } = require('../../utils');

describe('FileUploadUtil', () => {
    let fileUploadUtil;
    const testUploadDir = path.join(process.cwd(), 'uploads', 'selfies');

    beforeEach(() => {
        fileUploadUtil = new FileUploadUtil();
    });

    afterEach(async () => {
        // Clean up test files
        try {
            const files = await fs.readdir(testUploadDir);
            for (const file of files) {
                if (file.startsWith('selfie_')) {
                    await fs.unlink(path.join(testUploadDir, file));
                }
            }
        } catch (error) {
            // Directory might not exist or be empty
        }
    });

    describe('generateSecureFilename', () => {
        test('should generate unique filenames', () => {
            const filename1 = fileUploadUtil.generateSecureFilename('test.jpg');
            const filename2 = fileUploadUtil.generateSecureFilename('test.jpg');

            expect(filename1).not.toBe(filename2);
            expect(filename1).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
            expect(filename2).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
        });

        test('should preserve file extension', () => {
            const jpgFilename = fileUploadUtil.generateSecureFilename('test.jpg');
            const pngFilename = fileUploadUtil.generateSecureFilename('test.png');
            const webpFilename = fileUploadUtil.generateSecureFilename('test.webp');

            expect(jpgFilename).toMatch(/\.jpg$/);
            expect(pngFilename).toMatch(/\.png$/);
            expect(webpFilename).toMatch(/\.webp$/);
        });

        test('should handle uppercase extensions', () => {
            const filename = fileUploadUtil.generateSecureFilename('test.JPG');
            expect(filename).toMatch(/\.jpg$/);
        });

        test('should handle files without extensions', () => {
            const filename = fileUploadUtil.generateSecureFilename('test');
            expect(filename).toMatch(/^selfie_\d+_[a-f0-9]{32}$/);
        });
    });

    describe('validateFile', () => {
        test('should accept valid JPEG files', () => {
            const validFile = {
                mimetype: 'image/jpeg',
                size: 1024 * 1024, // 1MB
                originalname: 'test.jpg'
            };

            const result = fileUploadUtil.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept valid PNG files', () => {
            const validFile = {
                mimetype: 'image/png',
                size: 1024 * 1024, // 1MB
                originalname: 'test.png'
            };

            const result = fileUploadUtil.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should accept valid WebP files', () => {
            const validFile = {
                mimetype: 'image/webp',
                size: 1024 * 1024, // 1MB
                originalname: 'test.webp'
            };

            const result = fileUploadUtil.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject invalid mime types', () => {
            const invalidFile = {
                mimetype: 'text/plain',
                size: 1024,
                originalname: 'test.txt'
            };

            const result = fileUploadUtil.validateFile(invalidFile);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Invalid file type'))).toBe(true);
        });

        test('should reject files that are too large', () => {
            const largeFile = {
                mimetype: 'image/jpeg',
                size: 10 * 1024 * 1024, // 10MB (exceeds 5MB limit)
                originalname: 'test.jpg'
            };

            const result = fileUploadUtil.validateFile(largeFile);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('File too large'))).toBe(true);
        });

        test('should reject files with mismatched extension and mime type', () => {
            const mismatchedFile = {
                mimetype: 'image/jpeg',
                size: 1024,
                originalname: 'test.png' // PNG extension with JPEG mime type
            };

            const result = fileUploadUtil.validateFile(mismatchedFile);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('File extension does not match file type'))).toBe(true);
        });

        test('should accept JPEG files with .jpeg extension', () => {
            const validFile = {
                mimetype: 'image/jpeg',
                size: 1024,
                originalname: 'test.jpeg'
            };

            const result = fileUploadUtil.validateFile(validFile);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should handle multiple validation errors', () => {
            const invalidFile = {
                mimetype: 'text/plain',
                size: 10 * 1024 * 1024, // Too large
                originalname: 'test.txt'
            };

            const result = fileUploadUtil.validateFile(invalidFile);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
            expect(result.errors.some(error => error.includes('Invalid file type'))).toBe(true);
            expect(result.errors.some(error => error.includes('File too large'))).toBe(true);
        });
    });

    describe('getFileUrl', () => {
        test('should generate correct file URL', () => {
            const filename = 'selfie_123456_abcdef.jpg';
            const url = fileUploadUtil.getFileUrl(filename);
            expect(url).toBe('/uploads/selfies/selfie_123456_abcdef.jpg');
        });

        test('should handle different file extensions', () => {
            const pngUrl = fileUploadUtil.getFileUrl('selfie_123456_abcdef.png');
            const webpUrl = fileUploadUtil.getFileUrl('selfie_123456_abcdef.webp');

            expect(pngUrl).toBe('/uploads/selfies/selfie_123456_abcdef.png');
            expect(webpUrl).toBe('/uploads/selfies/selfie_123456_abcdef.webp');
        });
    });

    describe('createUploadMiddleware', () => {
        test('should create multer middleware', () => {
            const middleware = fileUploadUtil.createUploadMiddleware();
            expect(middleware).toBeDefined();
            expect(typeof middleware.single).toBe('function');
        });
    });

    describe('validateImageDimensions', () => {
        test('should return valid for placeholder implementation', async () => {
            const result = await fileUploadUtil.validateImageDimensions('/fake/path');
            expect(result.isValid).toBe(true);
            expect(result.dimensions).toEqual({ width: 0, height: 0 });
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('deleteFile', () => {
        test('should return false for non-existent file', async () => {
            const result = await fileUploadUtil.deleteFile('non-existent-file.jpg');
            expect(result).toBe(false);
        });

        test('should delete existing file', async () => {
            // Create a test file first
            const testFilename = 'selfie_test_123.jpg';
            const testFilePath = path.join(testUploadDir, testFilename);

            // Ensure directory exists
            await fs.mkdir(testUploadDir, { recursive: true });

            // Create test file
            await fs.writeFile(testFilePath, 'test content');

            // Verify file exists
            const existsBefore = await fs.access(testFilePath).then(() => true).catch(() => false);
            expect(existsBefore).toBe(true);

            // Delete file
            const result = await fileUploadUtil.deleteFile(testFilename);
            expect(result).toBe(true);

            // Verify file is deleted
            const existsAfter = await fs.access(testFilePath).then(() => true).catch(() => false);
            expect(existsAfter).toBe(false);
        });
    });

    describe('Configuration', () => {
        test('should have correct file size limit', () => {
            expect(fileUploadUtil.maxFileSize).toBe(5 * 1024 * 1024); // 5MB
        });

        test('should have correct allowed mime types', () => {
            const expectedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            expect(fileUploadUtil.allowedMimeTypes).toEqual(expectedTypes);
        });

        test('should have correct max dimensions', () => {
            expect(fileUploadUtil.maxDimensions).toEqual({ width: 2048, height: 2048 });
        });

        test('should have correct upload directory', () => {
            const expectedDir = path.join(process.cwd(), 'uploads', 'selfies');
            expect(fileUploadUtil.uploadDir).toBe(expectedDir);
        });
    });
});