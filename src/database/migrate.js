const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * Database migration runner
 * Executes SQL migration files in order
 */
class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Get all migration files sorted by filename
   */
  getMigrationFiles() {
    try {
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
      return files;
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(filename) {
    const filePath = path.join(this.migrationsPath, filename);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Executing migration: ${filename}`);
      
      await pool.query(sql);
      console.log(`✓ Migration ${filename} completed successfully`);
      
      return true;
    } catch (error) {
      console.error(`✗ Migration ${filename} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename 
        ON schema_migrations(filename);
    `;
    
    try {
      await pool.query(sql);
      console.log('✓ Schema migrations table ready');
    } catch (error) {
      console.error('✗ Failed to create migrations table:', error.message);
      throw error;
    }
  }

  /**
   * Check if migration has been executed
   */
  async isMigrationExecuted(filename) {
    const result = await pool.query(
      'SELECT filename FROM schema_migrations WHERE filename = $1',
      [filename]
    );
    return result.rows.length > 0;
  }

  /**
   * Record migration as executed
   */
  async recordMigration(filename) {
    await pool.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      console.log('Starting database migrations...');
      
      // Create migrations tracking table
      await this.createMigrationsTable();
      
      // Get all migration files
      const migrationFiles = this.getMigrationFiles();
      
      if (migrationFiles.length === 0) {
        console.log('No migration files found');
        return;
      }

      let executedCount = 0;
      
      // Execute each migration
      for (const filename of migrationFiles) {
        const isExecuted = await this.isMigrationExecuted(filename);
        
        if (isExecuted) {
          console.log(`⏭ Skipping already executed migration: ${filename}`);
          continue;
        }
        
        await this.executeMigration(filename);
        await this.recordMigration(filename);
        executedCount++;
      }
      
      console.log(`\n✓ Database migrations completed! Executed ${executedCount} new migrations.`);
      
    } catch (error) {
      console.error('\n✗ Migration failed:', error.message);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      console.log('✓ Database connection successful');
      console.log(`  Current time: ${result.rows[0].current_time}`);
      return true;
    } catch (error) {
      console.error('✗ Database connection failed:', error.message);
      throw error;
    }
  }
}

// Export the class and create a convenience function
const migrationRunner = new MigrationRunner();

module.exports = {
  MigrationRunner,
  runMigrations: () => migrationRunner.runMigrations(),
  testConnection: () => migrationRunner.testConnection()
};

// Allow running migrations directly with node
if (require.main === module) {
  (async () => {
    try {
      await migrationRunner.testConnection();
      await migrationRunner.runMigrations();
      process.exit(0);
    } catch (error) {
      console.error('Migration script failed:', error);
      process.exit(1);
    }
  })();
}