const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Show',
      required: [true, 'showId is required'],
      index: true
    },
    row: {
      type: String,
      required: [true, 'Seat row is required'],
      trim: true,
      uppercase: true
    },
    seatNumber: {
      type: Number,
      required: [true, 'seatNumber is required']
    },
    status: {
      type: String,
      enum: {
        values: ['AVAILABLE', 'HELD', 'BOOKED'],
        message: '{VALUE} is not a supported seat status'
      },
      default: 'AVAILABLE'
    },
    holdToken: {
      type: String,
      default: null
    },
    holdExpiresAt: {
      type: Date,
      default: null
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on showId, row and seatNumber
seatSchema.index({ showId: 1, row: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model('Seat', seatSchema);

