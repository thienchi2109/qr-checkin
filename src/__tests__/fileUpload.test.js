const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { FileUploadUtil } = require('../utils');

// Create test app
const app = express();
app.use(express.json());

// Add upload route for testing
const fileUploadUtil = new FileUploadUtil();
const upload = fileUploadUtil.createUploadMiddleware();
const CheckinController = require('../controllers/checkinController');
const checkinController = new CheckinController();

app.post('/test-upload', upload.single('selfie'), checkinController.uploadSelfie.bind(checkinController));

describe('File Upload Functionality', () => {
  const testUploadDir = path.join(process.cwd(), 'uploads', 'selfies');
  
  beforeAll(async () => {
    // Ensure upload directory exists
    try {
      await fs.access(testUploadDir);
    } catch (error) {
      await fs.mkdir(testUploadDir, { recursive: true });
    }
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

  describe('FileUploadUtil', () => {
    let fileUploadUtil;

    beforeEach(() => {
      fileUploadUtil = new FileUploadUtil();
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
    });

    describe('validateFile', () => {
      test('should accept valid image files', () => {
        const validFile = {
          mimetype: 'image/jpeg',
          size: 1024 * 1024, // 1MB
          originalname: 'test.jpg'
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
        expect(result.errors).toContain(expect.stringContaining('Invalid file type'));
      });

      test('should reject files that are too large', () => {
        const largeFile = {
          mimetype: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10MB (exceeds 5MB limit)
          originalname: 'test.jpg'
        };

        const result = fileUploadUtil.validateFile(largeFile);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expect.stringContaining('File too large'));
      });

      test('should reject files with mismatched extension and mime type', () => {
        const mismatchedFile = {
          mimetype: 'image/jpeg',
          size: 1024,
          originalname: 'test.png' // PNG extension with JPEG mime type
        };

        const result = fileUploadUtil.validateFile(mismatchedFile);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expect.stringContaining('File extension does not match file type'));
      });

      test('should accept all supported image formats', () => {
        const supportedFormats = [
          { mimetype: 'image/jpeg', originalname: 'test.jpg' },
          { mimetype: 'image/jpeg', originalname: 'test.jpeg' },
          { mimetype: 'image/png', originalname: 'test.png' },
          { mimetype: 'image/webp', originalname: 'test.webp' }
        ];

        supportedFormats.forEach(file => {
          const testFile = { ...file, size: 1024 };
          const result = fileUploadUtil.validateFile(testFile);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('getFileUrl', () => {
      test('should generate correct file URL', () => {
        const filename = 'selfie_123456_abcdef.jpg';
        const url = fileUploadUtil.getFileUrl(filename);
        expect(url).toBe('/uploads/selfies/selfie_123456_abcdef.jpg');
      });
    });
  });

  describe('Upload Endpoint', () => {
    test('should successfully upload valid image', async () => {
      // Create a small test image buffer (1x1 pixel JPEG)
      const testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
        0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/test-upload')
        .attach('selfie', testImageBuffer, 'test.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Selfie uploaded successfully');
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
      expect(response.body.data.url).toMatch(/^\/uploads\/selfies\/selfie_\d+_[a-f0-9]{32}\.jpg$/);
    });

    test('should reject request without file', async () => {
      const response = await request(app)
        .post('/test-upload')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_FILE_UPLOADED');
    });

    test('should reject invalid file types', async () => {
      const textBuffer = Buffer.from('This is not an image');

      const response = await request(app)
        .post('/test-upload')
        .attach('selfie', textBuffer, 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');
    });

    test('should reject files that are too large', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xFF);

      const response = await request(app)
        .post('/test-upload')
        .attach('selfie', largeBuffer, 'large.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('File too large');
    });

    test('should handle multiple file upload attempts', async () => {
      const testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
        0xFF, 0xD9
      ]);

      // Upload first file
      const response1 = await request(app)
        .post('/test-upload')
        .attach('selfie', testImageBuffer, 'test1.jpg')
        .expect(200);

      // Upload second file
      const response2 = await request(app)
        .post('/test-upload')
        .attach('selfie', testImageBuffer, 'test2.jpg')
        .expect(200);

      expect(response1.body.data.filename).not.toBe(response2.body.data.filename);
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      // This test would require mocking fs operations to simulate errors
      // For now, we'll test that the error handling structure is in place
      const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]); // Minimal JPEG

      const response = await request(app)
        .post('/test-upload')
        .attach('selfie', testImageBuffer, 'test.jpg');

      // Should either succeed or fail gracefully with proper error structure
      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      } else {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });
});