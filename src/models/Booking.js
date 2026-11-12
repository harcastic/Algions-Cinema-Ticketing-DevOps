const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: [true, 'ticketId is required'],
      unique: true,
      trim: true
    },
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Show',
      required: [true, 'showId is required'],
      index: true
    },
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: [true, 'seatId is required']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['CONFIRMED', 'CANCELLED'],
        message: '{VALUE} is not a supported booking status'
      },
      default: 'CONFIRMED'
    },
    bookedAt: {
      type: Date,
      default: Date.now
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Partial unique index preventing multiple CONFIRMED bookings for the same seat,
// while allowing multiple CANCELLED bookings for historical tracking.
bookingSchema.index(
  { seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'CONFIRMED' }
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
