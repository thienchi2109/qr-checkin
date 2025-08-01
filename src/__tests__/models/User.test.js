const User = require('../../models/User');

describe('User Model', () => {
  describe('constructor', () => {
    it('should create a user with default values', () => {
      const user = new User();
      
      expect(user.id).toBeNull();
      expect(user.username).toBe('');
      expect(user.email).toBe('');
      expect(user.passwordHash).toBeNull();
      expect(user.role).toBe('admin');
      expect(user.isActive).toBe(true);
      expect(user.lastLogin).toBeNull();
      expect(user.createdAt).toBeNull();
      expect(user.updatedAt).toBeNull();
    });

    it('should create a user with provided data', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'super_admin',
        isActive: false,
        lastLogin: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      };

      const user = new User(userData);
      
      expect(user.id).toBe('user-123');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe('hashed-password');
      expect(user.role).toBe('super_admin');
      expect(user.isActive).toBe(false);
      expect(user.lastLogin).toBe('2024-01-01T12:00:00Z');
      expect(user.createdAt).toBe('2024-01-01T10:00:00Z');
      expect(user.updatedAt).toBe('2024-01-01T11:00:00Z');
    });
  });

  describe('validate', () => {
    let validUserData;

    beforeEach(() => {
      validUserData = {
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };
    });

    it('should validate a valid user', () => {
      const user = new User(validUserData);
      const validation = user.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    describe('username validation', () => {
      it('should require username', () => {
        const user = new User({ ...validUserData, username: '' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Username is required and must be a non-empty string');
      });

      it('should reject non-string username', () => {
        const user = new User({ ...validUserData, username: 123 });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Username is required and must be a non-empty string');
      });

      it('should require minimum length', () => {
        const user = new User({ ...validUserData, username: 'ab' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Username must be at least 3 characters long');
      });

      it('should reject username longer than 50 characters', () => {
        const user = new User({ ...validUserData, username: 'a'.repeat(51) });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Username must be 50 characters or less');
      });

      it('should validate username format', () => {
        const user = new User({ ...validUserData, username: 'test@user' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Username can only contain letters, numbers, underscores, and hyphens');
      });

      it('should allow valid username formats', () => {
        const validUsernames = ['test_user', 'test-user', 'testuser123', 'TestUser'];
        
        validUsernames.forEach(username => {
          const user = new User({ ...validUserData, username });
          const validation = user.validate();
          
          expect(validation.isValid).toBe(true);
        });
      });
    });

    describe('email validation', () => {
      it('should require email', () => {
        const user = new User({ ...validUserData, email: '' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Email is required and must be a string');
      });

      it('should validate email format', () => {
        const user = new User({ ...validUserData, email: 'invalid-email' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Email must be a valid email address');
      });

      it('should reject email longer than 255 characters', () => {
        const user = new User({ ...validUserData, email: 'a'.repeat(250) + '@example.com' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Email must be 255 characters or less');
      });
    });

    describe('role validation', () => {
      it('should validate role values', () => {
        const user = new User({ ...validUserData, role: 'invalid_role' });
        const validation = user.validate();
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Role must be either "admin" or "super_admin"');
      });

      it('should allow valid roles', () => {
        const validRoles = ['admin', 'super_admin'];
        
        validRoles.forEach(role => {
          const user = new User({ ...validUserData, role });
          const validation = user.validate();
          
          expect(validation.isValid).toBe(true);
        });
      });
    });

    it('should validate isActive as boolean', () => {
      const user = new User({ ...validUserData, isActive: 'true' });
      const validation = user.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('isActive must be a boolean');
    });

    it('should validate lastLogin as valid date when provided', () => {
      const user = new User({ ...validUserData, lastLogin: 'invalid-date' });
      const validation = user.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Last login must be a valid date');
    });

    it('should allow null lastLogin', () => {
      const user = new User({ ...validUserData, lastLogin: null });
      const validation = user.validate();
      
      expect(validation.isValid).toBe(true);
    });
  });

  describe('validatePassword', () => {
    let user;

    beforeEach(() => {
      user = new User();
    });

    it('should validate a strong password', () => {
      const validation = user.validatePassword('StrongPass123!');
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require password', () => {
      const validation = user.validatePassword('');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password is required and must be a string');
    });

    it('should require minimum length', () => {
      const validation = user.validatePassword('Short1!');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must be at least 8 characters long');
    });

    it('should limit maximum length', () => {
      const validation = user.validatePassword('A'.repeat(129) + '1!');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must be 128 characters or less');
    });

    it('should require uppercase letter', () => {
      const validation = user.validatePassword('lowercase123!');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letter', () => {
      const validation = user.validatePassword('UPPERCASE123!');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require number', () => {
      const validation = user.validatePassword('NoNumbers!');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must contain at least one number');
    });

    it('should require special character', () => {
      const validation = user.validatePassword('NoSpecialChar123');
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password must contain at least one special character');
    });

    it('should reject non-string password', () => {
      const validation = user.validatePassword(123);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Password is required and must be a string');
    });
  });

  describe('setPassword', () => {
    let user;

    beforeEach(() => {
      user = new User();
    });

    it('should hash a valid password', async () => {
      const password = 'StrongPass123!';
      
      await user.setPassword(password);
      
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash).not.toBe(password);
      expect(user.passwordHash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should throw error for invalid password', async () => {
      const password = 'weak';
      
      await expect(user.setPassword(password)).rejects.toThrow('Password validation failed');
    });
  });

  describe('verifyPassword', () => {
    let user;

    beforeEach(async () => {
      user = new User();
      await user.setPassword('StrongPass123!');
    });

    it('should verify correct password', async () => {
      const isValid = await user.verifyPassword('StrongPass123!');
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const isValid = await user.verifyPassword('WrongPassword123!');
      
      expect(isValid).toBe(false);
    });

    it('should return false when no password hash exists', async () => {
      const userWithoutPassword = new User();
      const isValid = await userWithoutPassword.verifyPassword('AnyPassword123!');
      
      expect(isValid).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should return user data without password hash', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'admin',
        isActive: true,
        lastLogin: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      };

      const user = new User(userData);
      const json = user.toJSON();
      
      expect(json).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        isActive: true,
        lastLogin: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      });
      expect(json.passwordHash).toBeUndefined();
    });
  });

  describe('toSafeJSON', () => {
    it('should return minimal user data for public APIs', () => {
      const userData = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'admin',
        isActive: true,
        lastLogin: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      };

      const user = new User(userData);
      const json = user.toSafeJSON();
      
      expect(json).toEqual({
        id: 'user-123',
        username: 'testuser',
        role: 'admin',
        isActive: true
      });
      expect(json.email).toBeUndefined();
      expect(json.passwordHash).toBeUndefined();
      expect(json.lastLogin).toBeUndefined();
      expect(json.createdAt).toBeUndefined();
      expect(json.updatedAt).toBeUndefined();
    });
  });
});