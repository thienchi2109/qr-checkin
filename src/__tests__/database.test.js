const { pool } = require('../config/database');
const { runMigrations, testConnection } = require('../database/migrate');
const { initializeDatabase, verifyTables } = require('../database/init');

describe('Database Schema Tests', () => {
  beforeAll(async () => {
    // Ensure database is initialized before running tests
    await testConnection();
    await runMigrations();
  });

  afterAll(async () => {
    // Clean up database connection
    await pool.end();
  });

  describe('Database Connection', () => {
    test('should connect to database successfully', async () => {
      const result = await testConnection();
      expect(result).toBe(true);
    });

    test('should execute basic query', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });
  });

  describe('Table Creation', () => {
    test('should have all required tables', async () => {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tableNames = result.rows.map(row => row.table_name);
      const expectedTables = ['users', 'events', 'checkins', 'schema_migrations'];
      
      expectedTables.forEach(table => {
        expect(tableNames).toContain(table);
      });
    });

    test('should have correct users table structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(row => row.column_name);
      const expectedColumns = ['id', 'email', 'password_hash', 'role', 'is_active', 'created_at', 'updated_at'];
      
      expectedColumns.forEach(column => {
        expect(columns).toContain(column);
      });
    });

    test('should have correct events table structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(row => row.column_name);
      const expectedColumns = ['id', 'name', 'description', 'start_time', 'end_time', 'geofence', 'qr_settings', 'is_active', 'created_by', 'created_at', 'updated_at'];
      
      expectedColumns.forEach(column => {
        expect(columns).toContain(column);
      });
    });

    test('should have correct checkins table structure', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'checkins' 
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(row => row.column_name);
      const expectedColumns = ['id', 'event_id', 'user_data', 'location', 'qr_token', 'checkin_time', 'ip_address', 'user_agent', 'validation_status', 'validation_errors', 'created_at'];
      
      expectedColumns.forEach(column => {
        expect(columns).toContain(column);
      });
    });
  });

  describe('Indexes', () => {
    test('should have performance indexes on events table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'events'
        ORDER BY indexname
      `);
      
      const indexes = result.rows.map(row => row.indexname);
      
      // Check for key performance indexes
      expect(indexes).toContain('idx_events_id');
      expect(indexes).toContain('idx_events_start_time');
      expect(indexes).toContain('idx_events_end_time');
      expect(indexes).toContain('idx_events_is_active');
    });

    test('should have performance indexes on checkins table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'checkins'
        ORDER BY indexname
      `);
      
      const indexes = result.rows.map(row => row.indexname);
      
      // Check for key performance indexes as per requirements
      expect(indexes).toContain('idx_checkins_event_id');
      expect(indexes).toContain('idx_checkins_checkin_time');
      expect(indexes).toContain('idx_checkins_event_time');
    });

    test('should have performance indexes on users table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'users'
        ORDER BY indexname
      `);
      
      const indexes = result.rows.map(row => row.indexname);
      
      expect(indexes).toContain('idx_users_email');
      expect(indexes).toContain('idx_users_role');
    });
  });

  describe('Constraints and Triggers', () => {
    test('should have foreign key constraints', async () => {
      const result = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      
      // Check specific foreign keys
      const foreignKeys = result.rows.map(row => ({
        table: row.table_name,
        column: row.column_name,
        foreignTable: row.foreign_table_name,
        foreignColumn: row.foreign_column_name
      }));
      
      // Events should reference users
      expect(foreignKeys).toContainEqual({
        table: 'events',
        column: 'created_by',
        foreignTable: 'users',
        foreignColumn: 'id'
      });
      
      // Checkins should reference events
      expect(foreignKeys).toContainEqual({
        table: 'checkins',
        column: 'event_id',
        foreignTable: 'events',
        foreignColumn: 'id'
      });
    });

    test('should have updated_at triggers', async () => {
      const result = await pool.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%updated_at%'
      `);
      
      const triggers = result.rows.map(row => row.event_object_table);
      expect(triggers).toContain('users');
      expect(triggers).toContain('events');
    });
  });

  describe('Data Validation', () => {
    let testUserId;
    let testEventId;

    beforeEach(async () => {
      // Clean up test data
      await pool.query('DELETE FROM checkins WHERE user_data->>\'email\' LIKE \'test%\'');
      await pool.query('DELETE FROM events WHERE name LIKE \'Test%\'');
      await pool.query('DELETE FROM users WHERE email LIKE \'test%\'');
    });

    test('should insert and validate user data', async () => {
      const result = await pool.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('test@example.com', 'hashed_password', 'admin')
        RETURNING id, email, role, is_active, created_at
      `);
      
      testUserId = result.rows[0].id;
      expect(result.rows[0].email).toBe('test@example.com');
      expect(result.rows[0].role).toBe('admin');
      expect(result.rows[0].is_active).toBe(true);
      expect(result.rows[0].created_at).toBeDefined();
    });

    test('should insert and validate event data with geofence', async () => {
      // First create a user
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('test-admin@example.com', 'hashed_password', 'admin')
        RETURNING id
      `);
      testUserId = userResult.rows[0].id;

      const geofence = {
        type: 'circle',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        radius: 100
      };

      const result = await pool.query(`
        INSERT INTO events (name, description, start_time, end_time, geofence, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, geofence, is_active
      `, [
        'Test Event',
        'Test Description',
        new Date(Date.now() + 3600000), // 1 hour from now
        new Date(Date.now() + 7200000), // 2 hours from now
        JSON.stringify(geofence),
        testUserId
      ]);
      
      testEventId = result.rows[0].id;
      expect(result.rows[0].name).toBe('Test Event');
      expect(result.rows[0].geofence.type).toBe('circle');
      expect(result.rows[0].is_active).toBe(true);
    });

    test('should insert and validate checkin data', async () => {
      // Create user and event first
      const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('test-admin2@example.com', 'hashed_password', 'admin')
        RETURNING id
      `);
      testUserId = userResult.rows[0].id;

      const eventResult = await pool.query(`
        INSERT INTO events (name, start_time, end_time, geofence, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        'Test Event 2',
        new Date(Date.now() + 3600000),
        new Date(Date.now() + 7200000),
        JSON.stringify({ type: 'circle', coordinates: { lat: 40.7128, lng: -74.0060 }, radius: 100 }),
        testUserId
      ]);
      testEventId = eventResult.rows[0].id;

      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        idNumber: '12345'
      };

      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      };

      const result = await pool.query(`
        INSERT INTO checkins (event_id, user_data, location, qr_token, validation_status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_data, location, validation_status, checkin_time
      `, [
        testEventId,
        JSON.stringify(userData),
        JSON.stringify(location),
        'test_token_123',
        'success'
      ]);
      
      expect(result.rows[0].user_data.name).toBe('John Doe');
      expect(result.rows[0].location.latitude).toBe(40.7128);
      expect(result.rows[0].validation_status).toBe('success');
      expect(result.rows[0].checkin_time).toBeDefined();
    });

    afterEach(async () => {
      // Clean up test data
      await pool.query('DELETE FROM checkins WHERE user_data->>\'email\' LIKE \'test%\' OR user_data->>\'email\' = \'john@example.com\'');
      await pool.query('DELETE FROM events WHERE name LIKE \'Test%\'');
      await pool.query('DELETE FROM users WHERE email LIKE \'test%\'');
    });
  });
});