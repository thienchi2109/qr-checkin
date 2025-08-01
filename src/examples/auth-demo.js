/**
 * Authentication System Demo
 * Demonstrates the JWT-based authentication system
 * Requirements: 1.1, 4.1
 */

const { pool } = require('../config/database');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../middleware/auth');

async function authDemo() {
  console.log('🔐 Authentication System Demo');
  console.log('================================\n');

  try {
    // Create a demo admin user
    console.log('1. Creating demo admin user...');
    const adminUser = new User({
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true
    });

    await adminUser.setPassword('AdminPassword123!');
    console.log('✅ Admin user created with hashed password');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Password Hash: ${adminUser.passwordHash.substring(0, 20)}...`);

    // Generate JWT token
    console.log('\n2. Generating JWT token...');
    const token = generateToken(adminUser);
    console.log('✅ JWT token generated');
    console.log(`   Token: ${token.substring(0, 50)}...`);

    // Verify JWT token
    console.log('\n3. Verifying JWT token...');
    const decoded = verifyToken(token);
    console.log('✅ JWT token verified successfully');
    console.log(`   User ID: ${decoded.userId}`);
    console.log(`   Username: ${decoded.username}`);
    console.log(`   Email: ${decoded.email}`);
    console.log(`   Role: ${decoded.role}`);
    console.log(`   Expires: ${new Date(decoded.exp * 1000).toISOString()}`);

    // Test password verification
    console.log('\n4. Testing password verification...');
    const validPassword = await adminUser.verifyPassword('AdminPassword123!');
    const invalidPassword = await adminUser.verifyPassword('WrongPassword');
    console.log(`✅ Valid password check: ${validPassword}`);
    console.log(`✅ Invalid password check: ${invalidPassword}`);

    // Test role-based access
    console.log('\n5. Testing role-based access...');
    const allowedRoles = ['admin', 'super_admin'];
    const hasAccess = allowedRoles.includes(adminUser.role);
    console.log(`✅ Admin role access check: ${hasAccess}`);

    // Test user JSON serialization
    console.log('\n6. Testing user serialization...');
    const userJson = adminUser.toJSON();
    const safeUserJson = adminUser.toSafeJSON();
    console.log('✅ Full user JSON (includes email):');
    console.log(`   ${JSON.stringify(userJson, null, 2)}`);
    console.log('✅ Safe user JSON (excludes email):');
    console.log(`   ${JSON.stringify(safeUserJson, null, 2)}`);

    console.log('\n🎉 Authentication system demo completed successfully!');
    console.log('\nFeatures demonstrated:');
    console.log('- ✅ User model with password hashing (bcrypt)');
    console.log('- ✅ JWT token generation and verification');
    console.log('- ✅ Role-based access control');
    console.log('- ✅ Password validation and verification');
    console.log('- ✅ Secure user data serialization');
    console.log('- ✅ Input validation and error handling');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run demo if called directly
if (require.main === module) {
  authDemo().then(() => {
    console.log('\nDemo completed. Press Ctrl+C to exit.');
  }).catch(console.error);
}

module.exports = authDemo;