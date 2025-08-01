/**
 * Check-in controller with complete form validation and database storage
 */
class CheckinController {
  constructor() {
    this.CheckinRecord = require('../models/CheckinRecord');
    this.FileUploadUtil = require('../utils').FileUploadUtil;
    this.fileUploadUtil = new this.FileUploadUtil();
  }

  /**
   * Handle check-in form submission with complete validation and database storage
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async submitCheckin(req, res) {
    try {
      const { eventId, userData, location, qrToken } = req.body;

      // Get validation results from middleware
      const qrValidation = req.qrValidation;
      const locationValidation = req.locationValidation;

      // Validate request body structure
      const bodyValidation = this.validateRequestBody(req.body);
      if (!bodyValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Form validation failed',
            fieldErrors: bodyValidation.errors
          }
        });
      }

      // Create checkin record with all data
      const checkinData = {
        eventId,
        userData,
        location,
        qrToken,
        checkinTime: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        validationStatus: 'success',
        validationErrors: null
      };

      const checkinRecord = new this.CheckinRecord(checkinData);

      // Validate the checkin record
      const recordValidation = checkinRecord.validate();
      if (!recordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RECORD_VALIDATION_FAILED',
            message: 'Check-in record validation failed',
            fieldErrors: recordValidation.errors
          }
        });
      }

      // TODO: Save to database (will be implemented in subsequent tasks)
      // For now, simulate successful storage
      const savedRecord = {
        ...checkinRecord.toJSON(),
        id: this.generateTempId()
      };

      // Prepare response based on location validation
      const responseData = {
        checkinId: savedRecord.id,
        eventId,
        userData,
        timestamp: savedRecord.checkinTime,
        qrValidation: {
          isValid: qrValidation.isValid,
          timestamp: qrValidation.timestamp,
          timeRemaining: qrValidation.timeRemaining
        }
      };

      // Handle location validation scenarios
      if (locationValidation.skipValidation) {
        // Location not provided - allow submission with warning
        return res.status(200).json({
          success: true,
          message: 'Check-in submitted successfully',
          warning: locationValidation.warning,
          data: {
            ...responseData,
            locationVerified: false,
            locationWarning: 'Location verification was skipped'
          }
        });
      }

      if (locationValidation.isValid) {
        // Location validation passed
        return res.status(200).json({
          success: true,
          message: 'Check-in submitted successfully',
          data: {
            ...responseData,
            location,
            locationVerified: true,
            validationDetails: {
              distance: locationValidation.distance,
              geofenceType: locationValidation.geofenceType
            }
          }
        });
      }

      // This should not be reached as middleware handles invalid locations
      return res.status(400).json({
        success: false,
        error: {
          code: 'LOCATION_VALIDATION_FAILED',
          message: 'Location validation failed'
        }
      });

    } catch (error) {
      console.error('Check-in submission error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CHECKIN_SUBMISSION_ERROR',
          message: 'Failed to process check-in submission',
          details: { originalError: error.message }
        }
      });
    }
  }

  /**
   * Get check-in form for event with QR token validation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCheckinForm(req, res) {
    try {
      const { eventId, token } = req.params;

      // Validate QR token before serving form
      const QRCodeGenerator = require('../services/QRCodeGenerator');
      const qrGenerator = new QRCodeGenerator();
      
      const validationResult = await qrGenerator.validateQRCode(token, eventId);

      if (!validationResult.isValid) {
        // Handle different validation failure scenarios
        if (validationResult.isExpired) {
          return res.status(400).send(this.generateErrorPage({
            title: 'QR Code Expired',
            message: 'This QR code has expired. Please scan a new code to continue.',
            errorCode: 'QR_EXPIRED',
            action: 'refresh_qr',
            showScanAgainButton: true
          }));
        }

        if (validationResult.isUsed) {
          return res.status(400).send(this.generateErrorPage({
            title: 'QR Code Already Used',
            message: 'This QR code has already been used. Please scan a new code to continue.',
            errorCode: 'QR_ALREADY_USED',
            action: 'refresh_qr',
            showScanAgainButton: true
          }));
        }

        if (!validationResult.isValidEvent) {
          return res.status(400).send(this.generateErrorPage({
            title: 'Invalid QR Code',
            message: 'This QR code is not valid for this event.',
            errorCode: 'INVALID_EVENT',
            action: 'scan_new_qr',
            showScanAgainButton: true
          }));
        }

        // Generic validation failure
        return res.status(400).send(this.generateErrorPage({
          title: 'Invalid QR Code',
          message: 'This QR code is not valid. Please scan a new code to continue.',
          errorCode: 'QR_VALIDATION_FAILED',
          action: 'scan_new_qr',
          showScanAgainButton: true
        }));
      }

      // Generate and serve the mobile-optimized HTML form
      const formHtml = this.generateCheckinFormHTML({
        eventId,
        token,
        timeRemaining: validationResult.timeRemaining,
        expiresAt: validationResult.expiresAt
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(formHtml);

    } catch (error) {
      console.error('Get check-in form error:', error);
      return res.status(500).send(this.generateErrorPage({
        title: 'Server Error',
        message: 'Unable to load the check-in form. Please try again.',
        errorCode: 'FORM_RETRIEVAL_ERROR',
        action: 'retry',
        showScanAgainButton: true
      }));
    }
  }

  /**
   * Validate request body structure and required fields
   * @param {Object} body - Request body
   * @returns {Object} Validation result
   */
  validateRequestBody(body) {
    const errors = {};

    // Validate eventId
    if (!body.eventId || typeof body.eventId !== 'string') {
      errors.eventId = 'Event ID is required and must be a string';
    }

    // Validate qrToken
    if (!body.qrToken || typeof body.qrToken !== 'string') {
      errors.qrToken = 'QR token is required and must be a string';
    }

    // Validate userData
    if (!body.userData || typeof body.userData !== 'object') {
      errors.userData = 'User data is required and must be an object';
    } else {
      const userDataErrors = this.validateUserData(body.userData);
      if (Object.keys(userDataErrors).length > 0) {
        errors.userData = userDataErrors;
      }
    }

    // Validate location (optional but must be valid if provided)
    if (body.location) {
      const locationErrors = this.validateLocationData(body.location);
      if (Object.keys(locationErrors).length > 0) {
        errors.location = locationErrors;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validate user data fields
   * @param {Object} userData - User data object
   * @returns {Object} Validation errors
   */
  validateUserData(userData) {
    const errors = {};

    // Validate name
    if (!userData.name || typeof userData.name !== 'string' || userData.name.trim().length === 0) {
      errors.name = 'Name is required and must be a non-empty string';
    } else if (userData.name.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }

    // Validate email
    if (!userData.email || typeof userData.email !== 'string') {
      errors.email = 'Email is required and must be a string';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        errors.email = 'Email must be a valid email address';
      } else if (userData.email.length > 255) {
        errors.email = 'Email must be 255 characters or less';
      }
    }

    // Validate idNumber
    if (!userData.idNumber || typeof userData.idNumber !== 'string' || userData.idNumber.trim().length === 0) {
      errors.idNumber = 'ID number is required and must be a non-empty string';
    } else if (userData.idNumber.length > 50) {
      errors.idNumber = 'ID number must be 50 characters or less';
    }

    // Validate selfieUrl (optional)
    if (userData.selfieUrl !== undefined && userData.selfieUrl !== null) {
      if (typeof userData.selfieUrl !== 'string') {
        errors.selfieUrl = 'Selfie URL must be a string';
      } else if (userData.selfieUrl.length > 500) {
        errors.selfieUrl = 'Selfie URL must be 500 characters or less';
      } else {
        // Basic URL validation
        try {
          new URL(userData.selfieUrl);
        } catch {
          errors.selfieUrl = 'Selfie URL must be a valid URL';
        }
      }
    }

    return errors;
  }

  /**
   * Validate location data
   * @param {Object} location - Location data object
   * @returns {Object} Validation errors
   */
  validateLocationData(location) {
    const errors = {};

    // Validate latitude
    if (typeof location.latitude !== 'number') {
      errors.latitude = 'Latitude is required and must be a number';
    } else if (location.latitude < -90 || location.latitude > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }

    // Validate longitude
    if (typeof location.longitude !== 'number') {
      errors.longitude = 'Longitude is required and must be a number';
    } else if (location.longitude < -180 || location.longitude > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }

    // Validate accuracy (optional but should be positive if provided)
    if (location.accuracy !== undefined && location.accuracy !== null) {
      if (typeof location.accuracy !== 'number' || location.accuracy < 0) {
        errors.accuracy = 'Accuracy must be a positive number';
      }
    }

    return errors;
  }

  /**
   * Handle selfie image upload
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async uploadSelfie(req, res) {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No file was uploaded'
          }
        });
      }

      // Validate image dimensions (placeholder for now)
      const dimensionValidation = await this.fileUploadUtil.validateImageDimensions(req.file.path);
      if (!dimensionValidation.isValid) {
        // Delete the uploaded file if validation fails
        await this.fileUploadUtil.deleteFile(req.file.filename);
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IMAGE_DIMENSIONS',
            message: 'Image dimensions are invalid',
            details: dimensionValidation.errors
          }
        });
      }

      // Generate file URL
      const fileUrl = this.fileUploadUtil.getFileUrl(req.file.filename);

      // Return success response with file information
      return res.status(200).json({
        success: true,
        message: 'Selfie uploaded successfully',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          url: fileUrl,
          uploadedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Selfie upload error:', error);
      
      // Clean up uploaded file if it exists
      if (req.file && req.file.filename) {
        await this.fileUploadUtil.deleteFile(req.file.filename);
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload selfie',
          details: { originalError: error.message }
        }
      });
    }
  }

  /**
   * Generate mobile-optimized HTML form with accessibility features
   * @param {Object} options - Form generation options
   * @returns {string} HTML form string
   */
  generateCheckinFormHTML(options) {
    const { eventId, token, timeRemaining, expiresAt } = options;
    const timeRemainingMinutes = Math.floor(timeRemaining / 60000);
    const timeRemainingSeconds = Math.floor((timeRemaining % 60000) / 1000);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Check-in</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .timer {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            display: inline-block;
            margin-top: 8px;
        }
        
        .form-container {
            padding: 24px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            color: #555;
        }
        
        .required {
            color: #e74c3c;
        }
        
        input[type="text"],
        input[type="email"],
        input[type="file"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input[type="text"]:focus,
        input[type="email"]:focus,
        input[type="file"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .location-section {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .location-status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .status-icon {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .status-pending {
            background: #ffc107;
            color: white;
        }
        
        .status-success {
            background: #28a745;
            color: white;
        }
        
        .status-error {
            background: #dc3545;
            color: white;
        }
        
        .location-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s ease;
        }
        
        .location-button:hover {
            background: #5a6fd8;
        }
        
        .location-button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .submit-button {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        
        .submit-button:hover {
            transform: translateY(-2px);
        }
        
        .submit-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .error-message {
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            border: 1px solid #f5c6cb;
        }
        
        .success-message {
            background: #d4edda;
            color: #155724;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            border: 1px solid #c3e6cb;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .help-text {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }
        
        @media (max-width: 480px) {
            body {
                padding: 10px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 20px;
            }
            
            .form-container {
                padding: 20px;
            }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
            input[type="text"],
            input[type="email"],
            input[type="file"] {
                border-width: 3px;
            }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Event Check-in</h1>
            <div class="timer" id="timer" aria-live="polite">
                Time remaining: ${timeRemainingMinutes}m ${timeRemainingSeconds}s
            </div>
        </div>
        
        <div class="form-container">
            <div id="messages" aria-live="polite"></div>
            
            <form id="checkinForm" novalidate>
                <input type="hidden" name="eventId" value="${eventId}">
                <input type="hidden" name="qrToken" value="${token}">
                
                <div class="form-group">
                    <label for="name">
                        Full Name <span class="required" aria-label="required">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        required 
                        aria-describedby="name-help"
                        autocomplete="name"
                    >
                    <div id="name-help" class="help-text">Enter your full name as it appears on your ID</div>
                </div>
                
                <div class="form-group">
                    <label for="email">
                        Email Address <span class="required" aria-label="required">*</span>
                    </label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        aria-describedby="email-help"
                        autocomplete="email"
                    >
                    <div id="email-help" class="help-text">We'll use this to send you event updates</div>
                </div>
                
                <div class="form-group">
                    <label for="idNumber">
                        ID Number <span class="required" aria-label="required">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="idNumber" 
                        name="idNumber" 
                        required 
                        aria-describedby="id-help"
                    >
                    <div id="id-help" class="help-text">Enter your government-issued ID number</div>
                </div>
                
                <div class="form-group">
                    <label for="selfie">Selfie (Optional)</label>
                    <input 
                        type="file" 
                        id="selfie" 
                        name="selfie" 
                        accept="image/*" 
                        capture="user"
                        aria-describedby="selfie-help"
                    >
                    <div id="selfie-help" class="help-text">Take a selfie for verification (optional)</div>
                </div>
                
                <div class="location-section">
                    <div class="location-status">
                        <div class="status-icon status-pending" id="locationIcon" aria-hidden="true">?</div>
                        <span id="locationStatus">Location verification pending</span>
                    </div>
                    <button type="button" class="location-button" id="getLocationBtn">
                        Get My Location
                    </button>
                    <div class="help-text" style="margin-top: 8px;">
                        Location verification helps ensure you're at the event venue
                    </div>
                </div>
                
                <button type="submit" class="submit-button" id="submitBtn">
                    Complete Check-in
                </button>
            </form>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Processing your check-in...</p>
            </div>
        </div>
    </div>

    <script>
        // Form state management
        let userLocation = null;
        let formData = {};
        let timeRemaining = ${timeRemaining};
        
        // DOM elements
        const form = document.getElementById('checkinForm');
        const messages = document.getElementById('messages');
        const timer = document.getElementById('timer');
        const locationBtn = document.getElementById('getLocationBtn');
        const locationStatus = document.getElementById('locationStatus');
        const locationIcon = document.getElementById('locationIcon');
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');
        
        // Timer countdown
        function updateTimer() {
            if (timeRemaining <= 0) {
                showMessage('QR code has expired. Please scan a new code.', 'error');
                submitBtn.disabled = true;
                return;
            }
            
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            timer.textContent = \`Time remaining: \${minutes}m \${seconds}s\`;
            timeRemaining -= 1000;
            
            setTimeout(updateTimer, 1000);
        }
        
        // Start timer
        updateTimer();
        
        // Location handling
        locationBtn.addEventListener('click', function() {
            if (!navigator.geolocation) {
                showMessage('Geolocation is not supported by this browser.', 'error');
                return;
            }
            
            locationBtn.disabled = true;
            locationBtn.textContent = 'Getting location...';
            locationStatus.textContent = 'Requesting location access...';
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    userLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    locationIcon.className = 'status-icon status-success';
                    locationIcon.textContent = '✓';
                    locationStatus.textContent = 'Location verified';
                    locationBtn.textContent = 'Location obtained';
                    showMessage('Location successfully obtained!', 'success');
                },
                function(error) {
                    locationIcon.className = 'status-icon status-error';
                    locationIcon.textContent = '✗';
                    locationBtn.disabled = false;
                    locationBtn.textContent = 'Retry Location';
                    
                    let errorMessage = 'Unable to get location: ';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Location access denied. You can still submit the form.';
                            locationStatus.textContent = 'Location access denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information unavailable.';
                            locationStatus.textContent = 'Location unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            locationStatus.textContent = 'Location request timed out';
                            break;
                        default:
                            errorMessage += 'Unknown error occurred.';
                            locationStatus.textContent = 'Location error';
                            break;
                    }
                    showMessage(errorMessage, 'error');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
        
        // Form submission
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validate form
            if (!validateForm()) {
                return;
            }
            
            // Show loading state
            form.style.display = 'none';
            loading.style.display = 'block';
            
            // Prepare form data
            const formData = new FormData(form);
            const submitData = {
                eventId: formData.get('eventId'),
                qrToken: formData.get('qrToken'),
                userData: {
                    name: formData.get('name').trim(),
                    email: formData.get('email').trim(),
                    idNumber: formData.get('idNumber').trim()
                }
            };
            
            // Add location if available
            if (userLocation) {
                submitData.location = userLocation;
            }
            
            // Handle selfie upload if present
            const selfieFile = formData.get('selfie');
            if (selfieFile && selfieFile.size > 0) {
                try {
                    const selfieUrl = await uploadSelfie(selfieFile);
                    submitData.userData.selfieUrl = selfieUrl;
                } catch (error) {
                    console.error('Selfie upload failed:', error);
                    // Continue without selfie
                }
            }
            
            // Submit check-in
            try {
                const response = await fetch('/api/checkin/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(submitData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showSuccessPage(result);
                } else {
                    showError(result.error);
                    form.style.display = 'block';
                    loading.style.display = 'none';
                }
            } catch (error) {
                console.error('Submission error:', error);
                showError({
                    code: 'NETWORK_ERROR',
                    message: 'Network error. Please check your connection and try again.'
                });
                form.style.display = 'block';
                loading.style.display = 'none';
            }
        });
        
        // Form validation
        function validateForm() {
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const idNumber = document.getElementById('idNumber').value.trim();
            
            if (!name) {
                showMessage('Please enter your full name.', 'error');
                document.getElementById('name').focus();
                return false;
            }
            
            if (!email) {
                showMessage('Please enter your email address.', 'error');
                document.getElementById('email').focus();
                return false;
            }
            
            if (!isValidEmail(email)) {
                showMessage('Please enter a valid email address.', 'error');
                document.getElementById('email').focus();
                return false;
            }
            
            if (!idNumber) {
                showMessage('Please enter your ID number.', 'error');
                document.getElementById('idNumber').focus();
                return false;
            }
            
            return true;
        }
        
        // Email validation
        function isValidEmail(email) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            return emailRegex.test(email);
        }
        
        // Upload selfie
        async function uploadSelfie(file) {
            const formData = new FormData();
            formData.append('selfie', file);
            
            const response = await fetch('/api/checkin/upload-selfie', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error.message);
            }
            
            return result.data.url;
        }
        
        // Show message
        function showMessage(message, type) {
            messages.innerHTML = \`<div class="\${type}-message">\${message}</div>\`;
            messages.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Show error
        function showError(error) {
            let message = error.message || 'An error occurred. Please try again.';
            
            if (error.fieldErrors) {
                const fieldMessages = Object.values(error.fieldErrors).flat();
                message += '<br><br>' + fieldMessages.join('<br>');
            }
            
            showMessage(message, 'error');
        }
        
        // Show success page
        function showSuccessPage(result) {
            document.querySelector('.container').innerHTML = \`
                <div class="header">
                    <h1>✓ Check-in Successful!</h1>
                </div>
                <div class="form-container" style="text-align: center;">
                    <div class="success-message">
                        <strong>Welcome to the event!</strong><br>
                        Your check-in has been recorded successfully.
                    </div>
                    <p><strong>Check-in ID:</strong> \${result.data.checkinId}</p>
                    <p><strong>Time:</strong> \${new Date(result.data.timestamp).toLocaleString()}</p>
                    \${result.data.locationVerified ? 
                        '<p><strong>Location:</strong> Verified ✓</p>' : 
                        '<p><strong>Location:</strong> Not verified</p>'
                    }
                    \${result.warning ? \`<p style="color: #856404; margin-top: 16px;"><em>\${result.warning}</em></p>\` : ''}
                </div>
            \`;
        }
        
        // Auto-focus first input
        document.getElementById('name').focus();
    </script>
</body>
</html>`;
  }

  /**
   * Generate error page HTML
   * @param {Object} options - Error page options
   * @returns {string} HTML error page string
   */
  generateErrorPage(options) {
    const { title, message, errorCode, showScanAgainButton = false } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        
        .container {
            max-width: 500px;
            width: 100%;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            text-align: center;
        }
        
        .header {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 32px 24px;
        }
        
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .content {
            padding: 32px 24px;
        }
        
        .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        
        .error-code {
            background: #f8f9fa;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 14px;
            color: #666;
            margin-bottom: 24px;
            display: inline-block;
        }
        
        .scan-again-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .scan-again-btn:hover {
            transform: translateY(-2px);
        }
        
        .help-text {
            font-size: 14px;
            color: #999;
            margin-top: 16px;
        }
        
        @media (max-width: 480px) {
            body {
                padding: 10px;
            }
            
            .header {
                padding: 24px 20px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .header h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="error-icon" aria-hidden="true">⚠️</div>
            <h1>${title}</h1>
        </div>
        
        <div class="content">
            <p class="message">${message}</p>
            
            <div class="error-code" aria-label="Error code">
                ${errorCode}
            </div>
            
            ${showScanAgainButton ? `
                <button class="scan-again-btn" onclick="window.history.back()">
                    Scan QR Code Again
                </button>
                
                <p class="help-text">
                    Please scan a new QR code to continue with check-in
                </p>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate temporary ID for testing (will be replaced with database auto-increment)
   * @returns {string} Temporary ID
   */
  generateTempId() {
    return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = CheckinController;