const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * Reads the token from `Authorization: Bearer <token>`
 * Verifies using JWT_SECRET and attaches req.user = { _id, email }
 * Rejects missing, invalid, or expired tokens with HTTP 401
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Missing Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'cinema_dev_secret_key_1234567890';
    const decoded = jwt.verify(token, secret);
    req.user = {
      _id: decoded.id || decoded.userId || decoded._id,
      email: decoded.email
    };
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token.'
    });
  }
};

module.exports = authMiddleware;

