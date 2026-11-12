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

const createShow = async (req, res, next) => {
  try {
    const show = await showService.createShow(req.body);
    res.status(201).json({
      message: 'Show created successfully',
      show
    });
  } catch (error) {
    next(error);
  }
};

const createSeats = async (req, res, next) => {
  try {
    const seats = await showService.createSeatsForShow(req.params.showId, req.body);
    res.status(201).json({
      message: `Successfully created ${seats.length} seats for show`,
      count: seats.length,
      seats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllShows,
  getShowById,
  createShow,
  createSeats
};

