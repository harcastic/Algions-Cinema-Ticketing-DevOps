const crypto = require('crypto');

/**
 * Generates a unique, human-readable ticket ID.
 * Format: TCK-<TIMESTAMP>-<RANDOM_HEX>
 * Example: TCK-M1A2B3C-9F3A
 */
const generateTicketId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TCK-${timestampPart}-${randomPart}`;
};

module.exports = generateTicketId;

