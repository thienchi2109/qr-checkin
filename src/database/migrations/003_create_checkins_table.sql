-- Migration: Create checkins table for check-in records
-- Requirements: 1.1, 3.4, 6.3

CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_data JSONB NOT NULL,
    location JSONB NOT NULL,
    qr_token VARCHAR(255) NOT NULL,
    checkin_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    validation_status VARCHAR(50) NOT NULL DEFAULT 'success',
    validation_errors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_validation_status CHECK (validation_status IN ('success', 'failed')),
    CONSTRAINT check_user_data_required CHECK (
        user_data ? 'name' AND 
        user_data ? 'email' AND 
        user_data ? 'idNumber'
    ),
    CONSTRAINT check_location_required CHECK (
        location ? 'latitude' AND 
        location ? 'longitude'
    )
);

-- Create indexes for performance optimization on eventId, timestamp, and location fields
CREATE INDEX IF NOT EXISTS idx_checkins_event_id ON checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checkin_time ON checkins(checkin_time);
CREATE INDEX IF NOT EXISTS idx_checkins_event_time ON checkins(event_id, checkin_time);
CREATE INDEX IF NOT EXISTS idx_checkins_qr_token ON checkins(qr_token);
CREATE INDEX IF NOT EXISTS idx_checkins_validation_status ON checkins(validation_status);
CREATE INDEX IF NOT EXISTS idx_checkins_ip_address ON checkins(ip_address);

-- Create GIN indexes for JSONB fields for efficient querying
CREATE INDEX IF NOT EXISTS idx_checkins_user_data ON checkins USING GIN (user_data);
CREATE INDEX IF NOT EXISTS idx_checkins_location ON checkins USING GIN (location);
CREATE INDEX IF NOT EXISTS idx_checkins_validation_errors ON checkins USING GIN (validation_errors);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_checkins_event_status_time ON checkins(event_id, validation_status, checkin_time);
CREATE INDEX IF NOT EXISTS idx_checkins_location_coords ON checkins USING GIN ((location->'latitude'), (location->'longitude'));

-- Create partial indexes for successful checkins (most common queries)
CREATE INDEX IF NOT EXISTS idx_checkins_successful ON checkins(event_id, checkin_time) 
    WHERE validation_status = 'success';