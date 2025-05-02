/**
 * Custom error classes and error handling utilities for MCP server
 */

const logger = require('./logger');

/**
 * Base class for application-specific errors
 * @extends Error
 */
class McpError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} [options={}] - Additional error options
   * @param {string} [options.code] - Error code
   * @param {boolean} [options.isOperational=true] - Whether this is an operational error
   * @param {Object} [options.details={}] - Additional error details
   */
  constructor(message, { code = 'MCP_ERROR', isOperational = true, details = {} } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Creates a client-safe representation of the error
   * @returns {Object} Safe error object for client responses
   */
  toClientError() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      ...this.details
    };
  }
}

/**
 * Error for invalid input data
 * @extends McpError
 */
class ValidationError extends McpError {
  /**
   * @param {string} message - Error message
   * @param {Object} [details={}] - Validation error details
   */
  constructor(message, details = {}) {
    super(message, { 
      code: 'VALIDATION_ERROR',
      isOperational: true,
      details
    });
  }
}

/**
 * Error for resource not found
 * @extends McpError
 */
class NotFoundError extends McpError {
  /**
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional details
   */
  constructor(message, details = {}) {
    super(message, {
      code: 'NOT_FOUND',
      isOperational: true,
      details
    });
  }
}

/**
 * Error for rate limiting
 * @extends McpError
 */
class RateLimitError extends McpError {
  /**
   * @param {string} message - Error message
   * @param {Object} [details={}] - Rate limit details
   */
  constructor(message, details = {}) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      isOperational: true,
      details
    });
  }
}

/**
 * Error for unauthorized actions
 * @extends McpError
 */
class UnauthorizedError extends McpError {
  /**
   * @param {string} message - Error message
   * @param {Object} [details={}] - Additional details
   */
  constructor(message, details = {}) {
    super(message, {
      code: 'UNAUTHORIZED',
      isOperational: true,
      details
    });
  }
}

/**
 * Handles an error by logging it and returning a standardized error response
 * @param {Error} error - The error to handle
 * @param {string} context - The context where the error occurred
 * @returns {Object} Standardized error response object
 */
function handleError(error, context) {
  // Log all errors
  logger.error(`Error in ${context}`, error);
  
  // Handle known error types
  if (error instanceof McpError) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(error.toClientError())
      }],
      isError: true
    };
  }
  
  // Convert rate limit errors from the rate limiter
  if (error.message && error.message.includes('Rate limit exceeded')) {
    const rateLimitError = new RateLimitError(error.message);
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(rateLimitError.toClientError())
      }],
      isError: true
    };
  }
  
  // For unknown errors, create a safe response
  const safeErrorMessage = process.env.NODE_ENV === 'development' 
    ? error.message
    : 'An unexpected error occurred';
    
  return {
    content: [{ 
      type: 'text', 
      text: JSON.stringify({
        error: true,
        code: 'INTERNAL_ERROR',
        message: safeErrorMessage,
        context
      })
    }],
    isError: true
  };
}

module.exports = {
  McpError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  handleError
};