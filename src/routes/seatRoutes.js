const express = require('express');
const router = express.Router();
const seatController = require('../controllers/seatController');
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// Hold seat temporarily (Protected)
router.post('/:seatId/hold', authMiddleware, seatController.holdSeat);

// Confirm seat booking with holdToken (Protected)
router.post('/:seatId/confirm', authMiddleware, bookingController.confirmBooking);

module.exports = router;

