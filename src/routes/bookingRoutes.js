const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// Get booking details (Protected, owner only)
router.get('/:bookingId', authMiddleware, bookingController.getBooking);

// Cancel booking (Protected, owner only)
router.post('/:bookingId/cancel', authMiddleware, bookingController.cancelBooking);

module.exports = router;

