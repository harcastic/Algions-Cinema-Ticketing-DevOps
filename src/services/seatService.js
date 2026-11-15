const crypto = require('crypto');
const Seat = require('../models/Seat');
const Show = require('../models/Show');


const getSeatsByShowId = async (showId) => {
  const show = await Show.findById(showId);
  if (!show) {
    const error = new Error(`Show with id '${showId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const seats = await Seat.find({ showId }).sort({ row: 1, seatNumber: 1 });
  const now = new Date();

  return seats.map((seat) => {
    const seatObj = seat.toObject();
    // Dynamically reflect expired holds as AVAILABLE to callers
    if (seatObj.status === 'HELD' && seatObj.holdExpiresAt && new Date(seatObj.holdExpiresAt) <= now) {
      seatObj.status = 'AVAILABLE';
      seatObj.holdExpiresAt = null;
      seatObj.holdToken = null;
      seatObj.userId = null;
    }
    return seatObj;
  });
};

const holdSeat = async (seatId, userId) => {
  const holdDurationMinutes = parseFloat(process.env.HOLD_DURATION_MINUTES) || 3;
  const holdDurationMs = holdDurationMinutes * 60 * 1000;
  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + holdDurationMs);
  const holdToken = crypto.randomUUID();

  // ATOMIC CONDITIONAL UPDATE:
  // Updates ONLY if status is AVAILABLE OR status is HELD with an expired hold.
  const updatedSeat = await Seat.findOneAndUpdate(
    {
      _id: seatId,
      $or: [
        { status: 'AVAILABLE' },
        { status: 'HELD', holdExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: 'HELD',
        holdToken,
        holdExpiresAt,
        userId: userId || null,
        bookingId: null
      }
    },
    { new: true }
  );

  if (!updatedSeat) {
    const existingSeat = await Seat.findById(seatId);
    if (!existingSeat) {
      const error = new Error(`Seat with id '${seatId}' not found`);
      error.statusCode = 404;
      throw error;
    }

    const error = new Error('Seat is currently unavailable (already booked or actively held)');
    error.statusCode = 409;
    throw error;
  }

  return {
    message: 'Seat held successfully',
    seatId: updatedSeat._id,
    showId: updatedSeat.showId,
    row: updatedSeat.row,
    seatNumber: updatedSeat.seatNumber,
    holdToken: updatedSeat.holdToken,
    holdExpiresAt: updatedSeat.holdExpiresAt
  };
};

module.exports = {
  getSeatsByShowId,
  holdSeat
};

