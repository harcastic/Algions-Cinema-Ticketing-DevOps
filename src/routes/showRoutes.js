const express = require('express');
const router = express.Router();
const showController = require('../controllers/showController');
const seatController = require('../controllers/seatController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.get('/', showController.getAllShows);
router.get('/:showId', showController.getShowById);
router.get('/:showId/seats', seatController.getSeatsByShow);

// Protected routes (Require authentication)
router.post('/', authMiddleware, showController.createShow);
router.post('/:showId/seats', authMiddleware, showController.createSeats);

module.exports = router;

