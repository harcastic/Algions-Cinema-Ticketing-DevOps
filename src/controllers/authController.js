const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({
      message: 'User registered successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    res.status(200).json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};

