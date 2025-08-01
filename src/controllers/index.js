const CheckinController = require('./checkinController');
const eventController = require('./eventController');
const adminController = require('./adminController');

// Export controller instances
const checkinController = new CheckinController();

module.exports = {
  checkinController,
  eventController,
  adminController
};