const { testConnection, pool } = require('../config/database');
const { runMigrations } = require('./migrate');

/**
 * Database initialization script
 * Tests connection and runs migrations
 */
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database...\n');
    
    // Test database connection
    console.log('1. Testing database connection...');
    await testConnection();
    
    // Run migrations
    console.log('\n2. Running database migrations...');
    await runMigrations();
    
    console.log('\n✅ Database initialization completed successfully!');
    
    // Verify tables were created
    console.log('\n3. Verifying table creation...');
    await verifyTables();
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * Verify that all required tables exist
 */
async function verifyTables() {
  const expectedTables = ['users', 'events', 'checkins', 'schema_migrations'];
  
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const existingTables = result.rows.map(row => row.table_name);
    
    console.log('📋 Existing tables:');
    existingTables.forEach(table => {
      const status = expectedTables.includes(table) ? '✓' : '?';
      console.log(`  ${status} ${table}`);
    });
    
    // Check if all expected tables exist
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.warn(`⚠️  Missing tables: ${missingTables.join(', ')}`);
    } else {
      console.log('✅ All required tables exist');
    }
    
    // Show table counts
    console.log('\n📊 Table information:');
    for (const table of existingTables) {
      if (expectedTables.includes(table)) {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${countResult.rows[0].count} records`);
      }
    }
    
  } catch (error) {
    console.error('Error verifying tables:', error.message);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  verifyTables
};

// Allow running directly with node
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Database initialization script failed:', error);
      process.exit(1);
    }
  })();
}