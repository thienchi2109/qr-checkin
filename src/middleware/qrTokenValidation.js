const QRCodeGenerator = require('../services/QRCodeGenerator');

/**
 * QR Token validation middleware for API endpoints
 * Validates QR tokens for expiration and reuse prevention
 */
class QRTokenValidationMiddleware {
  constructor() {
    this.qrGenerator = new QRCodeGenerator();
  }

  /**
   * Middleware function to validate QR token for check-in requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  validateQRToken = async (req, res, next) => {
    try {
      const { eventId, qrToken } = req.body;

      // Check if QR token is provided
      if (!qrToken || typeof qrToken !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'QR_TOKEN_MISSING',
            message: 'QR token is required',
            action: 'scan_qr_code'
          }
        });
      }

      // Check if eventId is provided
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EVENT_ID_MISSING',
            message: 'Event ID is required'
          }
        });
      }

      // Validate QR token
      const validationResult = await this.qrGenerator.validateQRCode(qrToken, eventId);

      if (!validationResult.isValid) {
        // Handle different validation failure scenarios
        if (validationResult.isExpired) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'QR_EXPIRED',
              message: 'QR code has expired. Please scan a new code.',
              action: 'refresh_qr',
              details: {
                expiresAt: validationResult.expiresAt,
                timeRemaining: validationResult.timeRemaining
              }
            }
          });
        }

        if (validationResult.isUsed) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'QR_ALREADY_USED',
              message: 'This QR code has already been used. Please scan a new code.',
              action: 'refresh_qr'
            }
          });
        }

        if (!validationResult.isValidEvent) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_EVENT',
              message: 'QR code is not valid for this event',
              details: {
                expectedEventId: eventId,
                actualEventId: validationResult.eventId
              }
            }
          });
        }

        // Generic validation failure
        return res.status(400).json({
          success: false,
          error: {
            code: 'QR_VALIDATION_FAILED',
            message: validationResult.error || 'QR code validation failed',
            action: 'scan_new_qr'
          }
        });
      }

      // Mark token as used to prevent reuse
      await this.qrGenerator.markTokenAsUsed(qrToken);

      // Add validation result to request for use in subsequent middleware/controllers
      req.qrValidation = {
        isValid: true,
        eventId: validationResult.eventId,
        timestamp: validationResult.timestamp,
        expiresAt: validationResult.expiresAt,
        timeRemaining: validationResult.timeRemaining
      };

      next();
    } catch (error) {
      console.error('QR token validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'QR_VALIDATION_ERROR',
          message: 'Failed to validate QR token',
          details: { originalError: error.message }
        }
      });
    }
  };
}

module.exports = QRTokenValidationMiddleware;