const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const generateTicketId = require('../utils/generateTicketId');


const confirmBooking = async (seatId, holdToken, userId) => {
  if (!holdToken) {
    const error = new Error('holdToken is required');
    error.statusCode = 400;
    throw error;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();
    const seat = await Seat.findById(seatId).session(session);

    if (!seat) {
      const error = new Error(`Seat with id '${seatId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // Check if seat is currently held
    if (seat.status !== 'HELD') {
      const error = new Error(`Seat is not currently held (status: ${seat.status})`);
      error.statusCode = 409;
      throw error;
    }

    // Check if hold has expired (HTTP 410)
    if (seat.holdExpiresAt && new Date(seat.holdExpiresAt) <= now) {
      const error = new Error('Seat hold has expired. Please acquire a new hold');
      error.statusCode = 410;
      throw error;
    }

    // Verify hold token
    if (seat.holdToken !== holdToken) {
      const error = new Error('Invalid hold token');
      error.statusCode = 409;
      throw error;
    }

    // Verify user authorization (only the user who held the seat can confirm)
    if (seat.userId && userId && seat.userId.toString() !== userId.toString()) {
      const error = new Error('Forbidden: Seat was held by another user');
      error.statusCode = 403;
      throw error;
    }

    const ticketId = generateTicketId();

    // Create booking document inside transaction
    const [booking] = await Booking.create(
      [
        {
          ticketId,
          showId: seat.showId,
          seatId: seat._id,
          userId,
          status: 'CONFIRMED',
          bookedAt: now,
          cancelledAt: null
        }
      ],
      { session }
    );

    // Update seat document inside transaction
    seat.status = 'BOOKED';
    seat.bookingId = booking._id;
    seat.holdToken = null;
    seat.holdExpiresAt = null;
    await seat.save({ session });

    await session.commitTransaction();
    return booking;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelBooking = async (bookingId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      const error = new Error(`Booking with id '${bookingId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // Verify ownership
    if (booking.userId && userId && booking.userId.toString() !== userId.toString()) {
      const error = new Error('Forbidden: You can only cancel your own bookings');
      error.statusCode = 403;
      throw error;
    }

    if (booking.status === 'CANCELLED') {
      const error = new Error('Booking is already cancelled');
      error.statusCode = 400;
      throw error;
    }

    // Mark booking as CANCELLED
    const now = new Date();
    booking.status = 'CANCELLED';
    booking.cancelledAt = now;
    await booking.save({ session });

    // Release seat back to AVAILABLE
    const seat = await Seat.findById(booking.seatId).session(session);
    if (seat) {
      seat.status = 'AVAILABLE';
      seat.bookingId = null;
      seat.holdToken = null;
      seat.holdExpiresAt = null;
      seat.userId = null;
      await seat.save({ session });
    }

    await session.commitTransaction();
    return booking;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getBookingById = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId)
    .populate('showId', 'movieName screenName startsAt endsAt status')
    .populate('seatId', 'row seatNumber status');

  if (!booking) {
    const error = new Error(`Booking with id '${bookingId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  if (booking.userId && userId && booking.userId.toString() !== userId.toString()) {
    const error = new Error('Forbidden: You can only view your own bookings');
    error.statusCode = 403;
    throw error;
  }

  return booking;
};

module.exports = {
  confirmBooking,
  cancelBooking,
  getBookingById
};

