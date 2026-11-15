const Show = require('../models/Show');

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

module.exports = {
  getAllShows,
  getShowById
};
