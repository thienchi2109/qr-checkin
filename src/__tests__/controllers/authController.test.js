const { pool } = require('../../config/database');
const User = require('../../models/User');
const { generateToken } = require('../../middleware/auth');
const {
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword
} = require('../../controllers/authController');

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../middleware/auth');

describe('Auth Controller', () => {
  let mockClient;
  let mockReq;
  let mockRes;
  let mockUser;

  beforeEach(() => {
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect = jest.fn().mockResolvedValue(mockClient);

    // Mock user
    mockUser = new User({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      isActive: true
    });

    // Mock request and response
    mockReq = {
      body: {},
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock generateToken
    generateToken.mockReturnValue('mock-jwt-token');

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    beforeEach(() => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };
    });

    it('should login successfully with valid credentials', async () => {
      const mockUserData = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        password_hash: 'hashed-password',
        role: mockUser.role,
        is_active: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUserData] }) // SELECT user
        .mockResolvedValueOnce({ rows: [] }); // UPDATE last_login

      // Mock password verification
      const mockVerifyPassword = jest.spyOn(User.prototype, 'verifyPassword')
        .mockResolvedValue(true);

      await login(mockReq, mockRes);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        ['test@example.com']
      );
      expect(mockVerifyPassword).toHaveBeenCalledWith('TestPassword123!');
      expect(generateToken).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: expect.any(Object),
          token: 'mock-jwt-token',
          expiresIn: '24h'
        }
      });

      mockVerifyPassword.mockRestore();
    });

    it('should return 400 for missing credentials', async () => {
      mockReq.body = { email: 'test@example.com' }; // Missing password

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Email and password are required'
      });
    });

    it('should return 401 for user not found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    });

    it('should return 401 for invalid password', async () => {
      const mockUserData = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        password_hash: 'hashed-password',
        role: mockUser.role,
        is_active: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [mockUserData] });

      const mockVerifyPassword = jest.spyOn(User.prototype, 'verifyPassword')
        .mockResolvedValue(false);

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });

      mockVerifyPassword.mockRestore();
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'LOGIN_FAILED',
        message: 'Login failed due to server error'
      });
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await logout(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile when authenticated', async () => {
      mockReq.user = mockUser;

      await getProfile(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockUser.toJSON()
        }
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq.user = null;

      await getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.body = {
        username: 'newusername',
        email: 'newemail@example.com'
      };
    });

    it('should update profile successfully', async () => {
      const updatedUserData = {
        id: mockUser.id,
        username: 'newusername',
        email: 'newemail@example.com',
        role: mockUser.role,
        is_active: true,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [updatedUserData] });

      await updateProfile(mockReq, mockRes);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['newusername', 'newemail@example.com', mockUser.id])
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: expect.any(Object)
        }
      });
    });

    it('should return 400 for no updates', async () => {
      mockReq.body = {};

      await updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'NO_UPDATES',
        message: 'No valid fields to update'
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockReq.user = null;

      await updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    });

    it('should handle email conflict', async () => {
      const error = new Error('Unique constraint violation');
      error.code = '23505';
      mockClient.query.mockRejectedValue(error);

      await updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email address is already in use'
      });
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
      mockReq.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };
    });

    it('should change password successfully', async () => {
      const mockVerifyPassword = jest.spyOn(mockUser, 'verifyPassword')
        .mockResolvedValue(true);
      const mockValidatePassword = jest.spyOn(mockUser, 'validatePassword')
        .mockReturnValue({ isValid: true, errors: [] });
      const mockSetPassword = jest.spyOn(mockUser, 'setPassword')
        .mockResolvedValue();

      mockClient.query.mockResolvedValue({ rows: [] });

      await changePassword(mockReq, mockRes);

      expect(mockVerifyPassword).toHaveBeenCalledWith('OldPassword123!');
      expect(mockValidatePassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockSetPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });

      mockVerifyPassword.mockRestore();
      mockValidatePassword.mockRestore();
      mockSetPassword.mockRestore();
    });

    it('should return 400 for missing passwords', async () => {
      mockReq.body = { currentPassword: 'OldPassword123!' }; // Missing newPassword

      await changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_PASSWORDS',
        message: 'Current password and new password are required'
      });
    });

    it('should return 401 for incorrect current password', async () => {
      const mockVerifyPassword = jest.spyOn(mockUser, 'verifyPassword')
        .mockResolvedValue(false);

      await changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect'
      });

      mockVerifyPassword.mockRestore();
    });

    it('should return 400 for invalid new password', async () => {
      const mockVerifyPassword = jest.spyOn(mockUser, 'verifyPassword')
        .mockResolvedValue(true);
      const mockValidatePassword = jest.spyOn(mockUser, 'validatePassword')
        .mockReturnValue({ 
          isValid: false, 
          errors: ['Password must be at least 8 characters long'] 
        });

      await changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_NEW_PASSWORD',
        message: 'New password does not meet requirements',
        details: ['Password must be at least 8 characters long']
      });

      mockVerifyPassword.mockRestore();
      mockValidatePassword.mockRestore();
    });
  });
});