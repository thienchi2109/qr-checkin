const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');
const User = require('../../models/User');
const {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  optionalAuth,
  JWT_SECRET
} = require('../../middleware/auth');

// Mock database pool
jest.mock('../../config/database');

describe('Auth Middleware', () => {
  let mockUser;
  let mockClient;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Create mock user
    mockUser = new User({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      isActive: true
    });

    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    pool.connect = jest.fn().mockResolvedValue(mockClient);

    // Mock request, response, and next
    mockReq = {
      headers: {}
      // user and token are intentionally undefined initially
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.iss).toBe('qr-checkin-system');
      expect(decoded.aud).toBe('admin-dashboard');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('jwt malformed');
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );
      
      expect(() => verifyToken(expiredToken)).toThrow('jwt expired');
    });
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token and attach user to request', async () => {
      const token = generateToken(mockUser);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      mockClient.query.mockResolvedValue({
        rows: [{
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          password_hash: 'hashed-password',
          role: mockUser.role,
          is_active: true,
          last_login: null,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [mockUser.id]
      );
      expect(mockReq.user).toBeInstanceOf(User);
      expect(mockReq.user.id).toBe(mockUser.id);
      expect(mockReq.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 401 for missing authorization header', async () => {
      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Authorization token is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid authorization header format', async () => {
      mockReq.headers.authorization = 'InvalidFormat token';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Authorization token is required'
      });
    });

    it('should return 401 for invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Invalid token format'
      });
    });

    it('should return 401 for user not found', async () => {
      const token = generateToken(mockUser);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      mockClient.query.mockResolvedValue({ rows: [] });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found or inactive'
      });
    });

    it('should handle database errors', async () => {
      const token = generateToken(mockUser);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'AUTH_ERROR',
        message: 'Authentication failed'
      });
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    beforeEach(() => {
      mockReq.user = mockUser;
    });

    it('should allow access for user with correct role', () => {
      const middleware = authorize(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access when no specific roles required', () => {
      const middleware = authorize([]);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user with incorrect role', () => {
      const middleware = authorize(['super_admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Required roles: super_admin'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      mockReq.user = null;
      const middleware = authorize(['admin']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated'
      });
    });
  });

  describe('optionalAuth middleware', () => {
    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should authenticate when valid token provided', async () => {
      const token = generateToken(mockUser);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      mockClient.query.mockResolvedValue({
        rows: [{
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          role: mockUser.role,
          is_active: true,
          last_login: null,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeInstanceOf(User);
      expect(mockReq.user.id).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without authentication when invalid token provided', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});