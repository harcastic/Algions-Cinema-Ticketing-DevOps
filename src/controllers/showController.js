const showService = require('../services/showService');

const getAllShows = async (req, res, next) => {
  try {
    const shows = await showService.getAllShows();
    res.status(200).json(shows);
  } catch (error) {
    next(error);
  }
};

const getShowById = async (req, res, next) => {
  try {
    const show = await showService.getShowById(req.params.showId);
    res.status(200).json(show);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllShows,
  getShowById
};
