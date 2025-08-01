const express = require('express');
const path = require('path');
const { locationValidation } = require('../middleware');
const { checkinController } = require('../controllers');
const QRTokenValidationMiddleware = require('../middleware/qrTokenValidation');
const { FileUploadUtil } = require('../utils');

const router = express.Router();
const qrTokenValidation = new QRTokenValidationMiddleware();
const fileUploadUtil = new FileUploadUtil();
const upload = fileUploadUtil.createUploadMiddleware();

/**
 * Check-in routes with QR token and location validation middleware
 */

// GET /api/checkin/form/:eventId/:token - Get check-in form
router.get('/form/:eventId/:token', checkinController.getCheckinForm);

// POST /api/checkin/submit - Submit check-in with QR token and location validation
router.post('/submit', 
  qrTokenValidation.validateQRToken,    // Apply QR token validation middleware first
  locationValidation.validateLocation,  // Apply location validation middleware second
  checkinController.submitCheckin       // Handle the actual submission
);

// POST /api/checkin/upload-selfie - Upload selfie image with validation
router.post('/upload-selfie', 
  upload.single('selfie'),              // Apply multer middleware for file upload
  checkinController.uploadSelfie        // Handle the file upload
);

/**
 * @route   GET /api/checkin/validate-qr
 * @desc    Validate QR code token
 * @access  Public
 */
router.get('/validate-qr', async (req, res) => {
    try {
        const { token, eventId } = req.query;

        if (!token || !eventId) {
            return res.status(400).json({
                success: false,
                message: 'Token and eventId are required'
            });
        }

        // Use existing QR token validation middleware logic
        const isValid = await qrTokenValidation.isValidToken(token, eventId);
        const isExpired = await qrTokenValidation.isTokenExpired(token);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_QR',
                    message: 'Invalid QR code. Please scan a valid code.',
                    action: 'scan_again'
                }
            });
        }

        if (isExpired) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'QR_EXPIRED',
                    message: 'QR code has expired. Please scan a new code.',
                    action: 'refresh_qr'
                }
            });
        }

        res.json({
            success: true,
            data: {
                valid: true,
                eventId: eventId,
                token: token
            }
        });

    } catch (error) {
        console.error('Error validating QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate QR code',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Frontend routes - Serve HTML pages
 */

/**
 * @route   GET /checkin/:eventId/:token
 * @desc    Serve check-in form HTML page
 * @access  Public
 */
router.get('/:eventId/:token', (req, res) => {
    // Serve the main HTML file for the check-in form
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

/**
 * @route   GET /checkin
 * @desc    Serve check-in form HTML page (for manual entry)
 * @access  Public
 */
router.get('/', (req, res) => {
    // Serve the main HTML file for the check-in form
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

module.exports = router;