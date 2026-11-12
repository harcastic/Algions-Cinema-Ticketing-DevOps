const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const showRoutes = require('./routes/showRoutes');
const seatRoutes = require('./routes/seatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const { errorMiddleware, notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health & Readiness Endpoints
// GET /health - Process liveness check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// GET /ready - Database connectivity readiness check
app.get('/ready', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (isDbConnected) {
    return res.status(200).json({
      status: 'READY',
      database: 'connected'
    });
  }

  return res.status(503).json({
    status: 'NOT_READY',
    database: 'disconnected'
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);

// Unmatched route 404 handler
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorMiddleware);

module.exports = app;

