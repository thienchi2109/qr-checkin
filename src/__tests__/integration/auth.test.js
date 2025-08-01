const request = require('supertest');
const express = require('express');
const { pool } = require('../../config/database');
const User = require('../../models/User');
const authRoutes = require('../../routes/authRoutes');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Mock database pool
jest.mock('../../config/database');

describe('Auth Integration Tests', () => {
  let mockClient;
  let testUser;
  let testUserData;

  beforeEach(async () => {
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect = jest.fn().mockResolvedValue(mockClient);

    // Create test user
    testUser = new User({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      isActive: true
    });

    await testUser.setPassword('TestPassword123!');

    testUserData = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
      password_hash: testUser.passwordHash,
      role: testUser.role,
      is_active: true,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] }) // SELECT user
        .mockResolvedValueOnce({ rows: [] }); // UPDATE last_login

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toHaveProperty('id', testUser.id);
      expect(response.body.data.user).toHaveProperty('username', testUser.username);
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('expiresIn');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('MISSING_CREDENTIALS');
    });

    it('should return 401 for invalid email', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for invalid password', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should handle case-insensitive email', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        ['test@example.com']
      );
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get auth token
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.data.token;
      jest.clearAllMocks();
    });

    it('should logout successfully with valid token', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get auth token
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.data.token;
      jest.clearAllMocks();
    });

    it('should return user profile with valid token', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id', testUser.id);
      expect(response.body.data.user).toHaveProperty('username', testUser.username);
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get auth token
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.data.token;
      jest.clearAllMocks();
    });

    it('should update profile successfully', async () => {
      const updatedUserData = {
        ...testUserData,
        username: 'newusername',
        email: 'newemail@example.com'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] }) // Auth check
        .mockResolvedValueOnce({ rows: [updatedUserData] }); // Update query

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newusername',
          email: 'newemail@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.user.username).toBe('newusername');
      expect(response.body.data.user.email).toBe('newemail@example.com');
    });

    it('should return 400 for invalid email format', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_FAILED');
    });
  });

  describe('PUT /api/auth/change-password', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get auth token
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.data.token;
      jest.clearAllMocks();
    });

    it('should change password successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] }) // Auth check
        .mockResolvedValueOnce({ rows: [] }); // Update query

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should return 401 for incorrect current password', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('should return 400 for weak new password', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INVALID_NEW_PASSWORD');
    });
  });

  describe('GET /api/auth/admin-test', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get auth token
      mockClient.query
        .mockResolvedValueOnce({ rows: [testUserData] })
        .mockResolvedValueOnce({ rows: [] });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.data.token;
      jest.clearAllMocks();
    });

    it('should allow access for admin user', async () => {
      mockClient.query.mockResolvedValue({ rows: [testUserData] });

      const response = await request(app)
        .get('/api/auth/admin-test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Admin access granted');
      expect(response.body.user).toHaveProperty('id', testUser.id);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/auth/admin-test');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('MISSING_TOKEN');
    });
  });
});