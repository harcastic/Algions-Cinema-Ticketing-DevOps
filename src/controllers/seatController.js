const seatService = require('../services/seatService');

const getSeatsByShow = async (req, res, next) => {
  try {
    const seats = await seatService.getSeatsByShowId(req.params.showId);
    res.status(200).json(seats);
  } catch (error) {
    next(error);
  }
};

const holdSeat = async (req, res, next) => {
  try {
    const result = await seatService.holdSeat(req.params.seatId, req.user._id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSeatsByShow,
  holdSeat
};

