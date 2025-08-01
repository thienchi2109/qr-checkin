const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// Import the actual routes
const checkinRoutes = require('../../routes/checkinRoutes');

// Create test app with the actual route structure
const app = express();
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api/checkin', checkinRoutes);

describe('POST /api/checkin/upload-selfie Integration Tests', () => {
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

  describe('Successful Upload Scenarios', () => {
    test('should upload JPEG image successfully', async () => {
      // Create a minimal valid JPEG buffer
      const jpegBuffer = Buffer.from([
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
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, 'selfie.jpg')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Selfie uploaded successfully',
        data: {
          originalName: 'selfie.jpg',
          mimeType: 'image/jpeg'
        }
      });

      expect(response.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
      expect(response.body.data.url).toMatch(/^\/uploads\/selfies\/selfie_\d+_[a-f0-9]{32}\.jpg$/);
      expect(response.body.data.size).toBeGreaterThan(0);
      expect(response.body.data.uploadedAt).toBeDefined();

      // Verify file was actually created
      const filename = response.body.data.filename;
      const filePath = path.join(testUploadDir, filename);
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should upload PNG image successfully', async () => {
      // Create a minimal valid PNG buffer
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // IHDR data
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
        0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
      ]);

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', pngBuffer, 'selfie.png')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mimeType).toBe('image/png');
      expect(response.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.png$/);
    });
  });

  describe('Error Scenarios', () => {
    test('should return error when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No file was uploaded'
        }
      });
    });

    test('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is a text file, not an image');

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', textBuffer, 'document.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');
    });

    test('should reject files exceeding size limit', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xFF);

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', largeBuffer, 'large.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('File too large');
    });

    test('should reject files with mismatched extension and content type', async () => {
      // Send a text file with .jpg extension
      const textBuffer = Buffer.from('Not an image');

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', textBuffer, 'fake.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');
    });

    test('should handle multiple files (should only accept one)', async () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, 'selfie1.jpg')
        .attach('selfie', jpegBuffer, 'selfie2.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('File Security', () => {
    test('should generate unique filenames for identical uploads', async () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response1 = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, 'same-name.jpg')
        .expect(200);

      const response2 = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, 'same-name.jpg')
        .expect(200);

      expect(response1.body.data.filename).not.toBe(response2.body.data.filename);
      expect(response1.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
      expect(response2.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
    });

    test('should sanitize filenames and prevent directory traversal', async () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, '../../../malicious.jpg')
        .expect(200);

      // Should generate secure filename regardless of original name
      expect(response.body.data.filename).toMatch(/^selfie_\d+_[a-f0-9]{32}\.jpg$/);
      expect(response.body.data.filename).not.toContain('../');
    });
  });

  describe('Response Format', () => {
    test('should return complete file information on successful upload', async () => {
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);

      const response = await request(app)
        .post('/api/checkin/upload-selfie')
        .attach('selfie', jpegBuffer, 'test.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Selfie uploaded successfully');
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('originalName', 'test.jpg');
      expect(response.body.data).toHaveProperty('size');
      expect(response.body.data).toHaveProperty('mimeType', 'image/jpeg');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('uploadedAt');

      // Validate timestamp format
      expect(new Date(response.body.data.uploadedAt)).toBeInstanceOf(Date);
    });
  });
});