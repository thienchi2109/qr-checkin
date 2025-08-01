# Location Validation Middleware

This middleware provides geofence-based location validation for the QR check-in system. It validates user locations against event boundaries and provides detailed error responses for outside-geofence scenarios.

## Features

- **Multiple Geofence Types**: Supports both circular and polygon geofences
- **Detailed Error Responses**: Provides specific error codes and messages for different validation failures
- **Optional Location**: Allows check-in submission without location (with warning)
- **Distance Calculation**: Reports actual distance from geofence boundaries
- **Event Status Validation**: Checks if events are active before validating location

## Usage

### Basic Implementation

```javascript
const { locationValidation } = require('../middleware');

// Apply to check-in submission endpoint
router.post('/submit', 
  locationValidation.validateLocation,  // Apply location validation
  checkinController.submitCheckin       // Process check-in
);
```

### Request Format

The middleware expects the following request body structure:

```javascript
{
  eventId: "string",           // Required: Event ID
  location: {                  // Optional: User location
    latitude: number,          // GPS latitude
    longitude: number          // GPS longitude
  },
  userData: {                  // User form data
    name: "string",
    email: "string",
    idNumber: "string"
  },
  qrToken: "string"           // QR code token
}
```

### Response Formats

#### Success Response (Location Valid)
```javascript
{
  success: true,
  message: "Check-in submitted successfully",
  data: {
    eventId: "event-123",
    userData: { /* user data */ },
    location: { latitude: 37.7749, longitude: -122.4194 },
    timestamp: "2024-01-01T12:00:00.000Z",
    locationVerified: true,
    validationDetails: {
      distance: 25,              // Distance from center/boundary in meters
      geofenceType: "circle"     // Type of geofence validated against
    }
  }
}
```

#### Success Response (No Location Provided)
```javascript
{
  success: true,
  message: "Check-in submitted successfully",
  warning: "Location not provided - incomplete verification",
  data: {
    eventId: "event-123",
    userData: { /* user data */ },
    timestamp: "2024-01-01T12:00:00.000Z",
    locationVerified: false
  }
}
```

#### Error Response (Outside Geofence)
```javascript
{
  success: false,
  error: {
    code: "OUTSIDE_GEOFENCE",
    message: "You are outside the event area. Please move closer to the event location.",
    details: {
      userDistance: 250,         // User's distance from boundary in meters
      allowedRadius: 100,        // Allowed radius for circular geofence
      geofenceType: "circle"     // Type of geofence
    },
    action: "move_closer"        // Suggested user action
  }
}
```

#### Error Response (Event Not Found)
```javascript
{
  success: false,
  error: {
    code: "EVENT_NOT_FOUND",
    message: "Event not found",
    details: { eventId: "invalid-event-id" }
  }
}
```

#### Error Response (Event Inactive)
```javascript
{
  success: false,
  error: {
    code: "EVENT_INACTIVE",
    message: "Event is not currently active",
    details: { 
      eventId: "event-123", 
      isActive: false 
    }
  }
}
```

## Geofence Types

### Circular Geofence
```javascript
{
  type: "circle",
  coordinates: { 
    lat: 37.7749, 
    lng: -122.4194 
  },
  radius: 100  // meters
}
```

### Polygon Geofence
```javascript
{
  type: "polygon",
  coordinates: [
    { lat: 37.7700, lng: -122.4200 },
    { lat: 37.7800, lng: -122.4200 },
    { lat: 37.7800, lng: -122.4100 },
    { lat: 37.7700, lng: -122.4100 }
  ]
}
```

## Middleware Behavior

1. **Location Optional**: If no location is provided, validation is skipped with a warning
2. **Event Validation**: Checks if event exists and is active
3. **Geofence Validation**: Validates location against event boundaries
4. **Error Handling**: Provides specific error codes and recovery suggestions
5. **Request Enhancement**: Adds validation results to `req.locationValidation` for downstream use

## Integration with Controllers

The middleware adds a `locationValidation` object to the request:

```javascript
// In your controller
async function submitCheckin(req, res) {
  const locationValidation = req.locationValidation;
  
  if (locationValidation.skipValidation) {
    // Handle case where location was not provided
    console.log('Warning:', locationValidation.warning);
  } else if (locationValidation.isValid) {
    // Location validation passed
    console.log('Distance from boundary:', locationValidation.distance);
    console.log('Geofence type:', locationValidation.geofenceType);
  }
  
  // Process check-in...
}
```

## Error Codes Reference

| Code | Description | User Action |
|------|-------------|-------------|
| `OUTSIDE_GEOFENCE` | User is outside event boundaries | Move closer to event location |
| `EVENT_NOT_FOUND` | Event ID is invalid | Scan a new QR code |
| `EVENT_INACTIVE` | Event is not currently active | Contact event organizer |
| `LOCATION_VALIDATION_ERROR` | System error during validation | Try again or contact support |

## Testing

The middleware includes comprehensive tests covering:

- Valid location scenarios (inside geofence)
- Invalid location scenarios (outside geofence)
- Missing location handling
- Event validation (not found, inactive)
- Multiple geofence types (circle, polygon)
- Error handling and recovery
- Integration with Express routes

Run tests with:
```bash
npm test -- src/__tests__/middleware/locationValidation.test.js
npm test -- src/__tests__/integration/checkinFlow.test.js
```

## Requirements Compliance

This implementation satisfies the following requirements:

- **Requirement 3.3**: "WHEN GPS coordinates are provided THEN the system SHALL verify the location is within the geofenced area"
- **Requirement 2.7**: "WHEN form submission fails THEN the user SHALL see specific error messages explaining the reason"

## Future Enhancements

- Database integration for event retrieval (currently uses mock data)
- Real-time geofence updates
- Multiple geofence zones per event
- Location accuracy validation
- Geofence caching for performance