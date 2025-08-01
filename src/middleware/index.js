const LocationValidationMiddleware = require('./locationValidation');
const QRTokenValidationMiddleware = require('./qrTokenValidation');
const auth = require('./auth');

// Export middleware instances
const locationValidation = new LocationValidationMiddleware();
const qrTokenValidation = new QRTokenValidationMiddleware();

module.exports = {
  locationValidation,
  qrTokenValidation,
  auth
};