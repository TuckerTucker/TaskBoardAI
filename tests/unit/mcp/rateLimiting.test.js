/**
 * @jest-environment node
 */

// This test doesn't directly import the server module to avoid side effects
// Instead, we'll create a clean implementation of just the rate limiting code for testing

// Create a copy of the rate limiting code from the MCP server
const createRateLimiter = () => {
  // Global rate limiting
  const rateLimits = {
    operations: new Map(), // Map to track operations per minute
    maxOperationsPerMinute: 60 // Maximum operations allowed per minute
  };

  // Rate limiting middleware
  const checkRateLimit = () => {
    const now = Date.now();
    const minute = Math.floor(now / 60000); // Current minute
    
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
    
    // Check if limit exceeded
    if (count >= rateLimits.maxOperationsPerMinute) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Record this operation
    const operationId = `op_${now}_${Math.random().toString(36).substring(2, 15)}`;
    rateLimits.operations.set(operationId, now);
  };

  return { rateLimits, checkRateLimit };
};

describe('MCP Rate Limiting', () => {
  let rateLimiter;
  let originalDateNow;

  beforeEach(() => {
    rateLimiter = createRateLimiter();
    // Save the original Date.now implementation
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // Restore the original Date.now implementation
    Date.now = originalDateNow;
  });

  it('should allow operations up to the rate limit', () => {
    // Mock Date.now to return a fixed timestamp
    const mockTimestamp = 1615000000000; // Some fixed timestamp
    Date.now = jest.fn(() => mockTimestamp);

    // Set a lower rate limit for testing
    rateLimiter.rateLimits.maxOperationsPerMinute = 5;

    // Call the rate limiter up to the limit (should not throw)
    for (let i = 0; i < 5; i++) {
      expect(() => rateLimiter.checkRateLimit()).not.toThrow();
    }

    // Verify the operations were tracked
    expect(rateLimiter.rateLimits.operations.size).toBe(5);
  });

  it('should throw an error when rate limit is exceeded', () => {
    // Mock Date.now to return a fixed timestamp
    const mockTimestamp = 1615000000000; // Some fixed timestamp
    Date.now = jest.fn(() => mockTimestamp);

    // Set a lower rate limit for testing
    rateLimiter.rateLimits.maxOperationsPerMinute = 3;

    // Call the rate limiter up to the limit (should not throw)
    for (let i = 0; i < 3; i++) {
      rateLimiter.checkRateLimit();
    }

    // The next call should throw
    expect(() => rateLimiter.checkRateLimit()).toThrow(
      'Rate limit exceeded. Please try again later.'
    );
  });

  it('should clean up old entries when moving to a new minute', () => {
    // Mock Date.now for the first minute
    const firstMinuteTimestamp = 1615000000000; // Some timestamp
    Date.now = jest.fn(() => firstMinuteTimestamp);

    // Set a rate limit
    rateLimiter.rateLimits.maxOperationsPerMinute = 10;

    // Make some requests in the first minute
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkRateLimit();
    }

    expect(rateLimiter.rateLimits.operations.size).toBe(5);

    // Move to the next minute
    const nextMinuteTimestamp = firstMinuteTimestamp + 60000; // Add one minute
    Date.now = jest.fn(() => nextMinuteTimestamp);

    // Make a request in the new minute - this should trigger cleanup
    rateLimiter.checkRateLimit();

    // The old entries should be cleaned up, leaving only the new one
    expect(rateLimiter.rateLimits.operations.size).toBe(1);
  });

  it('should reset the counter for each new minute', () => {
    // Set a lower rate limit for testing
    rateLimiter.rateLimits.maxOperationsPerMinute = 3;

    // First minute: use up the rate limit
    const firstMinuteTimestamp = 1615000000000;
    Date.now = jest.fn(() => firstMinuteTimestamp);

    for (let i = 0; i < 3; i++) {
      rateLimiter.checkRateLimit();
    }

    // Should throw if we try another in the same minute
    expect(() => rateLimiter.checkRateLimit()).toThrow();

    // Move to the next minute
    const nextMinuteTimestamp = firstMinuteTimestamp + 60000;
    Date.now = jest.fn(() => nextMinuteTimestamp);

    // Should be able to make 3 more requests in the new minute
    for (let i = 0; i < 3; i++) {
      expect(() => rateLimiter.checkRateLimit()).not.toThrow();
    }

    // But then it should throw again
    expect(() => rateLimiter.checkRateLimit()).toThrow();
  });
});