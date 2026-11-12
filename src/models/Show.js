const mongoose = require('mongoose');

const showSchema = new mongoose.Schema(
  {
    movieName: {
      type: String,
      required: [true, 'Movie name is required'],
      trim: true
    },
    screenName: {
      type: String,
      required: [true, 'Screen name is required'],
      trim: true
    },
    startsAt: {
      type: Date,
      required: [true, 'Start time is required']
    },
    endsAt: {
      type: Date,
      required: [true, 'End time is required'],
      validate: {
        validator: function (value) {
          if (!this.startsAt || !value) return true;
          return new Date(value) > new Date(this.startsAt);
        },
        message: 'End time (endsAt) must be strictly after start time (startsAt)'
      }
    },
    status: {
      type: String,
      enum: {
        values: ['SCHEDULED', 'CANCELLED', 'COMPLETED'],
        message: '{VALUE} is not a supported show status'
      },
      default: 'SCHEDULED'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Show', showSchema);

