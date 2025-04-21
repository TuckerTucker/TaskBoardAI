/**
 * Global rate limiting middleware for MCP server
 */

const rateLimits = {
  operations: new Map(),
  maxOperationsPerMinute: 60
};

function checkRateLimit() {
  const now = Date.now();
  const minute = Math.floor(now / 60000);

  // Clean up old entries
  for (const [key, timestamp] of rateLimits.operations.entries()) {
    if (Math.floor(timestamp / 60000) < minute) {
      rateLimits.operations.delete(key);
    }
  }

  // Count operations in the current minute
  let count = 0;
  for (const timestamp of rateLimits.operations.values()) {
    if (Math.floor(timestamp / 60000) === minute) {
      count++;
    }
  }

  if (count >= rateLimits.maxOperationsPerMinute) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  const operationId = `op_${now}_${Math.random().toString(36).substring(2, 15)}`;
  rateLimits.operations.set(operationId, now);
}

module.exports = { checkRateLimit };
