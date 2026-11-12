const bookingService = require('../services/bookingService');

const confirmBooking = async (req, res, next) => {
  try {
    const { holdToken } = req.body;
    const booking = await bookingService.confirmBooking(
      req.params.seatId,
      holdToken,
      req.user._id
    );
    res.status(201).json({
      message: 'Booking confirmed successfully',
      booking
    });
  } catch (error) {
    next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params.bookingId,
      req.user._id
    );
    res.status(200).json({
      message: 'Booking cancelled successfully. Seat is now available.',
      booking
    });
  } catch (error) {
    next(error);
  }
};

const getBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(
      req.params.bookingId,
      req.user._id
    );
    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  confirmBooking,
  cancelBooking,
  getBooking
};

