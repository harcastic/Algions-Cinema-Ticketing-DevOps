const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

let replSet = null;

/**
 * Initializes and connects to a real MongoDB replica set for tests.
 * This guarantees support for real transactions and atomic operations.
 */
const startTestDB = async () => {
  if (process.env.TEST_MONGODB_URI) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    return;
  }

  // Create an in-memory real MongoDB single-node replica set
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: 'wiredTiger'
    }
  });

  const uri = replSet.getUri();
  await mongoose.connect(uri);
};

/**
 * Clears all collections in the database between tests.
 */
const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Disconnects and shuts down the test database.
 */
const stopTestDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  if (replSet) {
    await replSet.stop();
  }
};

/**
 * Helper to generate a valid auth token and user for test requests.
 */
const createTestUser = async (name = 'Test User', email = 'tester@example.com', password = 'password123') => {
  const user = await User.create({ name, email, password });
  const secret = process.env.JWT_SECRET || 'cinema_dev_secret_key_1234567890';
  const token = jwt.sign({ id: user._id, email: user.email }, secret, { expiresIn: '1d' });
  return { user, token, authHeader: `Bearer ${token}` };
};

module.exports = {
  startTestDB,
  clearTestDB,
  stopTestDB,
  createTestUser
};

