const { Pool } = require('pg');
require('dotenv').config();

/**
 * PostgreSQL connection pool configuration
 * Optimized for high concurrent loads as per requirement 6.3
 */
const pool = new Pool({
  // Use Neon connection string if provided, otherwise fall back to individual parameters
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'qr_checkin',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' || process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings for high performance
  max: 20, // Maximum number of clients in the pool
  min: 2,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
  acquireTimeoutMillis: 60000, // Return error after 60 seconds if client cannot be acquired
  
  // Query timeout
  query_timeout: 30000, // 30 seconds query timeout
  
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Handle pool connection events
pool.on('connect', (client) => {
  console.log('New client connected to database');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async () => {
  console.log('Closing database pool...');
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

module.exports = {
  pool,
  testConnection,
  gracefulShutdown
};