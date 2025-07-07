/**
 * Rate limiting middleware for MCP server with per-client tracking and improved efficiency.
 * Implements a sliding window approach to prevent traffic spikes at window boundaries.
 */

// Configuration
const config = {
  // Default limits
  defaultLimits: {
    read: { windowMs: 60000, maxRequests: 120 },   // 120 read ops per minute
    write: { windowMs: 60000, maxRequests: 60 }    // 60 write ops per minute
  },
  // Maximum number of clients to track (prevent memory leaks)
  maxClients: 1000,
  // How often to clean up stale client records (ms)
  cleanupInterval: 5 * 60 * 1000  // 5 minutes
};

// Rate limit storage
const clientLimits = new Map();
let lastCleanup = Date.now();

/**
 * Checks if a request exceeds the rate limit for the client
 * @param {object} options - Options for rate limiting
 * @param {string} [options.clientId='default'] - Identifier for the client
 * @param {string} [options.operationType='write'] - Type of operation ('read' or 'write')
 * @returns {void} - Throws an error if rate limit is exceeded
 */
function checkRateLimit({ clientId = 'default', operationType = 'write' } = {}) {
  const now = Date.now();
  
  // Run cleanup if needed
  if (now - lastCleanup > config.cleanupInterval) {
    cleanupStaleEntries(now);
    lastCleanup = now;
  }
  
  // Check if we're tracking too many clients (potential DoS)
  if (clientLimits.size >= config.maxClients && !clientLimits.has(clientId)) {
    throw new Error('Too many clients. Server is busy, please try again later.');
  }
  
  // Get or create client record
  let clientRecord = clientLimits.get(clientId);
  if (!clientRecord) {
    clientRecord = { 
      read: { operations: [], lastRequest: now },
      write: { operations: [], lastRequest: now }
    };
    clientLimits.set(clientId, clientRecord);
  }

  // Get the limit configuration based on operation type
  const limitType = operationType === 'read' ? 'read' : 'write';
  const limitConfig = config.defaultLimits[limitType];
  const clientOperations = clientRecord[limitType];
  
  // Update last request time
  clientOperations.lastRequest = now;
  
  // Clean up expired operations for this client
  const windowStart = now - limitConfig.windowMs;
  clientOperations.operations = clientOperations.operations.filter(
    timestamp => timestamp > windowStart
  );
  
  // Check if adding this operation would exceed the limit
  if (clientOperations.operations.length >= limitConfig.maxRequests) {
    throw new Error(`Rate limit exceeded for ${limitType} operations. Please try again later.`);
  }
  
  // Add the current operation
  clientOperations.operations.push(now);
  
  // Return rate limit info for debugging/headers if needed
  return {
    limit: limitConfig.maxRequests,
    remaining: limitConfig.maxRequests - clientOperations.operations.length,
    reset: Math.ceil((Math.min(...clientOperations.operations) + limitConfig.windowMs - now) / 1000)
  };
}

/**
 * Cleans up stale client records to prevent memory leaks
 * @param {number} now - Current timestamp
 * @private
 */
function cleanupStaleEntries(now) {
  const staleTime = now - Math.max(
    config.defaultLimits.read.windowMs,
    config.defaultLimits.write.windowMs
  ) - 60000; // Add a minute buffer
  
  for (const [clientId, record] of clientLimits.entries()) {
    if (record.read.lastRequest < staleTime && record.write.lastRequest < staleTime) {
      clientLimits.delete(clientId);
    }
  }
}

/**
 * Gets rate limiting stats for all clients
 * @returns {object} Statistics about current rate limiting state
 */
function getRateLimitStats() {
  return {
    totalClients: clientLimits.size,
    config: config,
    lastCleanup: new Date(lastCleanup).toISOString()
  };
}

// Export functions
module.exports = { 
  checkRateLimit,
  getRateLimitStats
};
