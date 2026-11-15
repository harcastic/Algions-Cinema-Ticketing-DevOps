const express = require('express');
const router = express.Router();
const showController = require('../controllers/showController');
const seatController = require('../controllers/seatController');

// Public routes
router.get('/', showController.getAllShows);
router.get('/:showId', showController.getShowById);
router.get('/:showId/seats', seatController.getSeatsByShow);

module.exports = router;
