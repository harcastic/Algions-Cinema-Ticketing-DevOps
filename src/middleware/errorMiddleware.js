/**
 * Centralized Error Handling Middleware
 * Ensures consistent JSON response format and appropriate HTTP status codes.
 * Prevents exposure of internal stack traces.
 */
const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected server error occurred';

  // Handle Mongoose Schema Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join(', ');
  }

  // Handle Mongoose Invalid ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for parameter: ${err.path}`;
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `Duplicate resource error: A record with that ${field} already exists`;
  }

  // Handle JWT verification errors if passed to next()
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired authentication token';
  }

  res.status(statusCode).json({
    error: message
  });
};

/**
 * 404 Not Found Middleware for unmatched endpoints
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`
  });
};

module.exports = { errorMiddleware, notFoundHandler };

