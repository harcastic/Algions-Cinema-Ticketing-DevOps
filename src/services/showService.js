const Show = require('../models/Show');
const Seat = require('../models/Seat');

const getAllShows = async () => {
  return Show.find().sort({ startsAt: 1 });
};

const getShowById = async (showId) => {
  const show = await Show.findById(showId);
  if (!show) {
    const error = new Error(`Show with id '${showId}' not found`);
    error.statusCode = 404;
    throw error;
  }
  return show;
};

const createShow = async (showData) => {
  const { movieName, screenName, startsAt, endsAt, status } = showData;

  if (!movieName || !screenName || !startsAt || !endsAt) {
    const error = new Error('movieName, screenName, startsAt, and endsAt are required');
    error.statusCode = 400;
    throw error;
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    const error = new Error('Invalid startsAt or endsAt date format');
    error.statusCode = 400;
    throw error;
  }

  if (endDate <= startDate) {
    const error = new Error('endsAt must be strictly after startsAt');
    error.statusCode = 400;
    throw error;
  }

  const show = new Show({
    movieName: movieName.trim(),
    screenName: screenName.trim(),
    startsAt: startDate,
    endsAt: endDate,
    status: status || 'SCHEDULED'
  });

  return show.save();
};

const createSeatsForShow = async (showId, seatPayload) => {
  // Verify show exists
  await getShowById(showId);

  let seatsToInsert = [];

  if (Array.isArray(seatPayload)) {
    seatsToInsert = seatPayload;
  } else if (Array.isArray(seatPayload.seats)) {
    seatsToInsert = seatPayload.seats;
  } else if (seatPayload.rows && seatPayload.seatsPerRow) {
    // Generate grid layout (e.g. rows ['A', 'B'], seatsPerRow: 5)
    for (const r of seatPayload.rows) {
      for (let num = 1; num <= seatPayload.seatsPerRow; num++) {
        seatsToInsert.push({ row: r, seatNumber: num });
      }
    }
  } else if (seatPayload.row && seatPayload.seatNumber) {
    seatsToInsert = [{ row: seatPayload.row, seatNumber: seatPayload.seatNumber }];
  } else {
    const error = new Error('Invalid seat definition payload. Provide seats array or row layout');
    error.statusCode = 400;
    throw error;
  }

  if (seatsToInsert.length === 0) {
    const error = new Error('No seats provided to create');
    error.statusCode = 400;
    throw error;
  }

  const seatDocs = seatsToInsert.map((s) => ({
    showId,
    row: String(s.row).trim().toUpperCase(),
    seatNumber: Number(s.seatNumber),
    status: 'AVAILABLE',
    holdToken: null,
    holdExpiresAt: null,
    userId: null,
    bookingId: null
  }));

  try {
    return await Seat.insertMany(seatDocs, { ordered: false });
  } catch (error) {
    if (error.code === 11000) {
      const conflictError = new Error('One or more seats already exist for this show');
      conflictError.statusCode = 409;
      throw conflictError;
    }
    throw error;
  }
};

module.exports = {
  getAllShows,
  getShowById,
  createShow,
  createSeatsForShow
};

