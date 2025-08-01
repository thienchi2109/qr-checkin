const express = require('express');
const checkinRoutes = require('./checkinRoutes');
const authRoutes = require('./authRoutes');
const eventRoutes = require('./eventRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

// Mount route modules
router.use('/checkin', checkinRoutes);
router.use('/auth', authRoutes);
router.use('/admin/events', eventRoutes);
router.use('/admin', adminRoutes);

module.exports = router;