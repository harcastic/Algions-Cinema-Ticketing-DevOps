const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'cinema_dev_secret_key_1234567890';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(
    {
      id: user._id,
      email: user.email
    },
    secret,
    { expiresIn }
  );
};

const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    const error = new Error('Name, email, and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('A user with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const user = new User({
    name: name.trim(),
    email: normalizedEmail,
    password
  });

  await user.save();
  const token = generateToken(user);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    }
  };
};

const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    }
  };
};

module.exports = {
  registerUser,
  loginUser
};

